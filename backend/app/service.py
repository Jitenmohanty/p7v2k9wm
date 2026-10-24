from __future__ import annotations

import asyncio
import time as clock
from datetime import datetime, time, timedelta, timezone
from typing import Any

from .analysis import build_dashboard
from .config import CACHE_TTL_SECONDS
from .elexon import ElexonClient

UTC = timezone.utc


class DashboardService:
    def __init__(self, elexon_client: ElexonClient, cache_ttl: int = CACHE_TTL_SECONDS) -> None:
        self._client = elexon_client
        self._cache_ttl = cache_ttl
        self._cache: tuple[float, list[dict[str, Any]], list[dict[str, Any]]] | None = None
        self._cache_lock = asyncio.Lock()

    async def get_dashboard(self, decision_date: date, cutoff_time: time) -> dict[str, Any]:
        actual_rows, forecast_rows = await self._get_month_data()
        return build_dashboard(actual_rows, forecast_rows, decision_date, cutoff_time)

    async def _get_month_data(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        now = clock.monotonic()
        if self._cache and self._cache[0] > now:
            return self._cache[1], self._cache[2]

        async with self._cache_lock:
            now = clock.monotonic()
            if self._cache and self._cache[0] > now:
                return self._cache[1], self._cache[2]

            actual_start = datetime(2026, 1, 2, tzinfo=UTC)
            actual_end = datetime(2026, 2, 1, tzinfo=UTC)
            # WINDFOR is filtered by publication time. Include the last pre-cutoff
            # forecast from 31 December for the first January decision day.
            forecast_start = datetime(2025, 12, 31, tzinfo=UTC)
            # Fetch every January publication so an operator can review a cutoff
            # later than the primary 09:20 reference as well.
            forecast_end = datetime(2026, 2, 1, tzinfo=UTC) - timedelta(seconds=1)
            actual_task = self._client.fetch_dataset("FUELHH", actual_start, actual_end)
            forecast_task = self._client.fetch_dataset("WINDFOR", forecast_start, forecast_end)
            actual_rows, forecast_rows = await asyncio.gather(actual_task, forecast_task)
            self._cache = (clock.monotonic() + self._cache_ttl, actual_rows, forecast_rows)
            return actual_rows, forecast_rows
