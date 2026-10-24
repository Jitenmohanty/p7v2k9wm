from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from .config import (
    DECISION_END,
    DECISION_START,
    EXPECTED_INTERVALS_PER_DAY,
    LOCAL_TIMEZONE,
)

UTC = timezone.utc
LONDON = ZoneInfo(LOCAL_TIMEZONE)


def parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def numeric_generation(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def calculate_metrics(
    pairs: Iterable[tuple[float, float]],
    expected_count: int,
) -> dict[str, float | int | None]:
    """Calculate metrics with error defined as forecast minus actual (MW)."""
    rows = list(pairs)
    errors = [forecast - actual for forecast, actual in rows]
    absolute_errors = [abs(error) for error in errors]
    actual_total = sum(actual for _, actual in rows)

    return {
        "sample_count": len(rows),
        "expected_count": expected_count,
        "coverage_pct": (len(rows) / expected_count * 100) if expected_count else 0.0,
        "mae_mw": (sum(absolute_errors) / len(rows)) if rows else None,
        "rmse_mw": math.sqrt(sum(error * error for error in errors) / len(rows)) if rows else None,
        "bias_mw": (sum(errors) / len(rows)) if rows else None,
        "wape_pct": (sum(absolute_errors) / actual_total * 100) if rows and actual_total else None,
        "overforecast_pct": (sum(error > 0 for error in errors) / len(errors) * 100) if errors else None,
    }


def build_dashboard(
    actual_rows: list[Mapping[str, Any]],
    forecast_rows: list[Mapping[str, Any]],
    decision_date: date,
    cutoff_time: time,
) -> dict[str, Any]:
    if not DECISION_START <= decision_date <= DECISION_END:
        raise ValueError("Decision date must be in January 2026")

    actuals = _latest_actuals(actual_rows)
    forecasts = _forecasts_by_target(forecast_rows)
    daily_summaries: list[dict[str, Any]] = []
    month_pairs: list[tuple[float, float]] = []
    selected_intervals: list[dict[str, Any]] = []
    selected_issue_times: list[datetime] = []

    for day_offset in range((DECISION_END - DECISION_START).days + 1):
        decision_day = DECISION_START + timedelta(days=day_offset)
        delivery_day = decision_day + timedelta(days=1)
        cutoff = datetime.combine(decision_day, cutoff_time, tzinfo=LONDON).astimezone(UTC)
        intervals = _build_day_intervals(delivery_day, cutoff, actuals, forecasts)
        pairs = [
            (point["forecast_mw"], point["actual_mw"])
            for point in intervals
            if point["forecast_mw"] is not None and point["actual_mw"] is not None
        ]
        metrics = calculate_metrics(pairs, EXPECTED_INTERVALS_PER_DAY)
        daily_summaries.append(
            {
                "decision_date": decision_day.isoformat(),
                "delivery_date": delivery_day.isoformat(),
                "sample_count": metrics["sample_count"],
                "coverage_pct": metrics["coverage_pct"],
                "mae_mw": metrics["mae_mw"],
                "bias_mw": metrics["bias_mw"],
            }
        )
        month_pairs.extend(pairs)

        if decision_day == decision_date:
            selected_intervals = intervals
            selected_issue_times = [point["publish_time"] for point in intervals if point["publish_time"]]

    all_month_pairs_expected = EXPECTED_INTERVALS_PER_DAY * len(daily_summaries)
    month_metrics = calculate_metrics(month_pairs, all_month_pairs_expected)
    issue_times = sorted(set(selected_issue_times))
    return {
        "period": {
            "decision_start": DECISION_START.isoformat(),
            "decision_end": DECISION_END.isoformat(),
            "timezone": LOCAL_TIMEZONE,
            "cutoff_time": cutoff_time.strftime("%H:%M"),
            "market_reference": "GB day-ahead 60-minute auction reference cutoff",
        },
        "metrics": month_metrics,
        "daily_metrics": daily_summaries,
        "selected_day": {
            "decision_date": decision_date.isoformat(),
            "delivery_date": (decision_date + timedelta(days=1)).isoformat(),
            "forecast_issue_from": issue_times[0] if issue_times else None,
            "forecast_issue_to": issue_times[-1] if issue_times else None,
            "intervals": selected_intervals,
        },
        "sources": [
            "Elexon BMRS Insights FUELHH (WIND)",
            "Elexon BMRS Insights WINDFOR",
        ],
        "error_definition": "forecast_mw - actual_mw; positive means wind was over-forecast",
    }


def _latest_actuals(rows: list[Mapping[str, Any]]) -> dict[datetime, float]:
    latest: dict[datetime, tuple[datetime, float]] = {}
    for row in rows:
        if str(row.get("fuelType", "")).upper() != "WIND":
            continue
        start_time = parse_timestamp(row.get("startTime"))
        generation = numeric_generation(row.get("generation"))
        if start_time is None or generation is None:
            continue
        publish_time = parse_timestamp(row.get("publishTime")) or datetime.min.replace(tzinfo=UTC)
        if start_time not in latest or publish_time >= latest[start_time][0]:
            latest[start_time] = (publish_time, generation)
    return {start_time: item[1] for start_time, item in latest.items()}


def _forecasts_by_target(
    rows: list[Mapping[str, Any]],
) -> dict[datetime, list[tuple[datetime, float]]]:
    result: dict[datetime, list[tuple[datetime, float]]] = {}
    for row in rows:
        start_time = parse_timestamp(row.get("startTime"))
        publish_time = parse_timestamp(row.get("publishTime"))
        generation = numeric_generation(row.get("generation"))
        if start_time is None or publish_time is None or generation is None:
            continue
        result.setdefault(start_time, []).append((publish_time, generation))
    for versions in result.values():
        versions.sort(key=lambda item: item[0])
    return result


def _build_day_intervals(
    delivery_day: date,
    cutoff: datetime,
    actuals: Mapping[datetime, float],
    forecasts: Mapping[datetime, list[tuple[datetime, float]]],
) -> list[dict[str, Any]]:
    start = datetime.combine(delivery_day, time.min, tzinfo=LONDON).astimezone(UTC)
    points: list[dict[str, Any]] = []
    for period in range(EXPECTED_INTERVALS_PER_DAY):
        start_time = start + timedelta(minutes=30 * period)
        available = [version for version in forecasts.get(start_time, []) if version[0] <= cutoff]
        selected = available[-1] if available else None
        forecast = selected[1] if selected else None
        actual = actuals.get(start_time)
        error = forecast - actual if forecast is not None and actual is not None else None
        local_start = start_time.astimezone(LONDON)
        points.append(
            {
                "start_time": start_time,
                "local_time": local_start.strftime("%H:%M"),
                "forecast_mw": forecast,
                "actual_mw": actual,
                "error_mw": error,
                "publish_time": selected[0] if selected else None,
            }
        )
    return points
