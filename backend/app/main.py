from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import date, time
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .config import DEFAULT_CUTOFF, DECISION_END, DECISION_START
from .elexon import ElexonApiError, ElexonClient
from .service import DashboardService

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    timeout = httpx.Timeout(45.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as http_client:
        app.state.dashboard_service = DashboardService(ElexonClient(http_client))
        yield


app = FastAPI(
    title="Wind Outlook API",
    version="1.0.0",
    description="January 2026 day-ahead wind forecast evaluation using Elexon data.",
    lifespan=lifespan,
)

origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def get_dashboard_service(request: Request) -> DashboardService:
    return request.app.state.dashboard_service


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "wind-outlook-api"}


@app.get("/api/dashboard")
async def dashboard(
    decision_date: date = Query(default=date(2026, 1, 15)),
    cutoff_time: time = Query(default=DEFAULT_CUTOFF),
    service: DashboardService = Depends(get_dashboard_service),
) -> dict:
    if not DECISION_START <= decision_date <= DECISION_END:
        raise HTTPException(status_code=422, detail="decision_date must be between 2026-01-01 and 2026-01-31")
    try:
        return await service.get_dashboard(decision_date, cutoff_time)
    except ElexonApiError as exc:
        raise HTTPException(
            status_code=502,
            detail="Elexon data is temporarily unavailable. Try again in a moment.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


if (STATIC_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False, response_model=None)
async def spa_fallback(path: str) -> FileResponse | HTMLResponse:
    requested = (STATIC_DIR / path).resolve()
    try:
        requested.relative_to(STATIC_DIR.resolve())
    except ValueError:
        requested = STATIC_DIR / "index.html"
    if path and requested.is_file():
        return FileResponse(requested)
    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return HTMLResponse(
        "<main><h1>Wind Outlook API</h1><p>Run the React development server on port 5173.</p></main>"
    )
