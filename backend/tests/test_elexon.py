import asyncio
from datetime import datetime, timezone

import httpx

from app.elexon import ElexonClient

UTC = timezone.utc


def test_elexon_client_requests_stream_window_and_accepts_wrapped_data() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"data": [{"fuelType": "WIND", "generation": 1}]})

    async def run() -> list[dict]:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
            client = ElexonClient(http_client)
            return await client.fetch_dataset(
                "FUELHH",
                datetime(2026, 1, 2, tzinfo=UTC),
                datetime(2026, 2, 1, tzinfo=UTC),
            )

    rows = asyncio.run(run())

    assert rows == [{"fuelType": "WIND", "generation": 1}]
    assert seen[0].url.path.endswith("/datasets/FUELHH/stream")
    assert seen[0].url.params["settlementDateFrom"] == "2026-01-02"
    assert seen[0].url.params["settlementDateTo"] == "2026-02-01"
    assert seen[0].url.params["fuelType"] == "WIND"


def test_wind_forecast_client_filters_by_publication_time() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=[])

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
            client = ElexonClient(http_client)
            await client.fetch_dataset(
                "WINDFOR",
                datetime(2025, 12, 31, tzinfo=UTC),
                datetime(2026, 1, 31, 9, 20, tzinfo=UTC),
            )

    asyncio.run(run())

    assert seen[0].url.path.endswith("/datasets/WINDFOR/stream")
    assert seen[0].url.params["publishDateTimeFrom"] == "2025-12-31T00:00:00+00:00"
    assert seen[0].url.params["publishDateTimeTo"] == "2026-01-31T09:20:00+00:00"


def test_elexon_client_rejects_dataset_outside_product_scope() -> None:
    async def run() -> None:
        async with httpx.AsyncClient() as http_client:
            client = ElexonClient(http_client)
            await client.fetch_dataset("NDF", datetime.now(UTC), datetime.now(UTC))

    try:
        asyncio.run(run())
    except ValueError as exc:
        assert "Unsupported Elexon dataset" in str(exc)
    else:
        raise AssertionError("Unsupported dataset should be rejected")
