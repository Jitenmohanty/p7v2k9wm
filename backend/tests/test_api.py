from datetime import date, datetime, time, timezone

from fastapi.testclient import TestClient

from app.main import app, get_dashboard_service

UTC = timezone.utc


class StubService:
    async def get_dashboard(self, decision_date: date, cutoff_time: time) -> dict:
        return {
            "period": {"cutoff_time": cutoff_time.strftime("%H:%M")},
            "metrics": {"mae_mw": 125.0, "sample_count": 2},
            "daily_metrics": [],
            "selected_day": {
                "decision_date": decision_date.isoformat(),
                "delivery_date": "2026-01-02",
                "forecast_issue_from": datetime(2026, 1, 1, 8, 30, tzinfo=UTC),
                "forecast_issue_to": datetime(2026, 1, 1, 8, 30, tzinfo=UTC),
                "intervals": [],
            },
            "sources": ["Elexon BMRS Insights FUELHH (WIND)", "Elexon BMRS Insights WINDFOR"],
            "error_definition": "forecast_mw - actual_mw",
        }


def test_dashboard_endpoint_returns_selected_decision_day_and_cutoff() -> None:
    app.dependency_overrides[get_dashboard_service] = lambda: StubService()
    try:
        with TestClient(app) as client:
            response = client.get("/api/dashboard", params={"decision_date": "2026-01-01", "cutoff_time": "09:20"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["selected_day"]["decision_date"] == "2026-01-01"
    assert body["period"]["cutoff_time"] == "09:20"
    assert body["metrics"]["mae_mw"] == 125.0


def test_dashboard_endpoint_rejects_dates_outside_the_decision_window() -> None:
    app.dependency_overrides[get_dashboard_service] = lambda: StubService()
    try:
        with TestClient(app) as client:
            response = client.get("/api/dashboard", params={"decision_date": "2026-02-01"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
