import asyncio
from datetime import date, datetime, time, timezone
from typing import Any

from app.service import DashboardService

UTC = timezone.utc


class FakeElexonClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, datetime, datetime]] = []

    async def fetch_dataset(self, dataset: str, start: datetime, end: datetime) -> list[dict[str, Any]]:
        self.calls.append((dataset, start, end))
        if dataset == "FUELHH":
            return [{
                "fuelType": "WIND",
                "startTime": "2026-01-02T00:00:00Z",
                "publishTime": "2026-01-02T01:00:00Z",
                "generation": 4100,
            }]
        return [{
            "startTime": "2026-01-02T00:00:00Z",
            "publishTime": "2026-01-01T08:30:00Z",
            "generation": 4000,
        }]


def test_service_loads_both_elexon_sources_and_caches_month_window() -> None:
    client = FakeElexonClient()
    service = DashboardService(client, cache_ttl=300)

    async def run() -> tuple[dict[str, Any], dict[str, Any]]:
        first = await service.get_dashboard(date(2026, 1, 1), time(9, 20))
        second = await service.get_dashboard(date(2026, 1, 1), time(9, 20))
        return first, second

    first, second = asyncio.run(run())

    assert [call[0] for call in client.calls] == ["FUELHH", "WINDFOR"]
    assert client.calls[0][1] == datetime(2026, 1, 2, tzinfo=UTC)
    assert client.calls[0][2] == datetime(2026, 2, 1, tzinfo=UTC)
    assert client.calls[1][1] == datetime(2025, 12, 31, tzinfo=UTC)
    assert client.calls[1][2] == datetime(2026, 1, 31, 23, 59, 59, tzinfo=UTC)
    assert first["metrics"]["sample_count"] == 1
    assert first["metrics"]["mae_mw"] == 100
    assert first["selected_day"]["intervals"][0]["forecast_mw"] == 4000
    assert second["metrics"] == first["metrics"]
