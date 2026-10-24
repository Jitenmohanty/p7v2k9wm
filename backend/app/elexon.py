from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from .config import ELEXON_BASE_URL


class ElexonApiError(RuntimeError):
    """Raised when the upstream Elexon API cannot provide usable data."""


class ElexonClient:
    """Small adapter around the public Elexon Insights dataset stream API."""

    def __init__(self, http_client: httpx.AsyncClient, base_url: str = ELEXON_BASE_URL) -> None:
        self._http = http_client
        self._base_url = base_url.rstrip("/")

    async def fetch_dataset(
        self,
        dataset: str,
        start: datetime,
        end: datetime,
    ) -> list[dict[str, Any]]:
        if dataset not in {"FUELHH", "WINDFOR"}:
            raise ValueError(f"Unsupported Elexon dataset: {dataset}")

        if dataset == "FUELHH":
            params: dict[str, Any] = {
                "settlementDateFrom": start.date().isoformat(),
                "settlementDateTo": end.date().isoformat(),
                "fuelType": "WIND",
            }
        else:
            params = {
                "publishDateTimeFrom": _format_utc(start),
                "publishDateTimeTo": _format_utc(end),
            }
        url = f"{self._base_url}/datasets/{dataset}/stream"
        try:
            response = await self._http.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ElexonApiError(f"Elexon {dataset} data could not be loaded") from exc

        if isinstance(payload, list):
            rows = payload
        elif isinstance(payload, dict) and isinstance(payload.get("data"), list):
            rows = payload["data"]
        else:
            raise ElexonApiError(f"Elexon returned an unexpected {dataset} response")

        return [row for row in rows if isinstance(row, dict)]


def _format_utc(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("Elexon query timestamps must include a timezone")
    return value.astimezone(timezone.utc).isoformat()
