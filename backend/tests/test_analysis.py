from datetime import date, time, timezone
from math import sqrt

import pytest

from app.analysis import build_dashboard, calculate_metrics

UTC = timezone.utc


def test_metrics_use_forecast_minus_actual_sign_convention() -> None:
    result = calculate_metrics([(110.0, 100.0), (80.0, 100.0)], expected_count=4)

    assert result["sample_count"] == 2
    assert result["coverage_pct"] == 50
    assert result["mae_mw"] == 15
    assert result["rmse_mw"] == pytest.approx(sqrt(250))
    assert result["bias_mw"] == -5
    assert result["wape_pct"] == 15
    assert result["overforecast_pct"] == 50


def test_metrics_handle_no_samples_and_zero_actual_denominator() -> None:
    empty = calculate_metrics([], expected_count=48)
    zero_actual = calculate_metrics([(5.0, 0.0)], expected_count=1)

    assert empty["mae_mw"] is None
    assert empty["wape_pct"] is None
    assert zero_actual["wape_pct"] is None


def test_dashboard_selects_latest_forecast_before_cutoff_and_filters_wind_actuals() -> None:
    actual_rows = [
        {"fuelType": "WIND", "startTime": "2026-01-02T00:00:00Z", "generation": 100},
        {"fuelType": "GAS", "startTime": "2026-01-02T00:00:00Z", "generation": 999},
    ]
    forecast_rows = [
        {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T08:30:00Z", "generation": 80},
        {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T09:15:00Z", "generation": 120},
        {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T09:21:00Z", "generation": 999},
    ]

    result = build_dashboard(actual_rows, forecast_rows, date(2026, 1, 1), time(9, 20))
    first = result["selected_day"]["intervals"][0]

    assert first["forecast_mw"] == 120
    assert first["actual_mw"] == 100
    assert first["error_mw"] == 20
    assert first["publish_time"].isoformat() == "2026-01-01T09:15:00+00:00"
    assert result["metrics"]["sample_count"] == 1
    assert result["metrics"]["bias_mw"] == 20
    assert result["period"]["timezone"] == "Europe/London"


def test_dashboard_does_not_interpolate_missing_hourly_forecast_points() -> None:
    actual_rows = [
        {"fuelType": "WIND", "startTime": "2026-01-02T00:00:00Z", "generation": 100},
        {"fuelType": "WIND", "startTime": "2026-01-02T00:30:00Z", "generation": 110},
    ]
    forecast_rows = [
        {"startTime": "2026-01-02T00:00:00Z", "publishTime": "2026-01-01T08:30:00Z", "generation": 120},
    ]

    result = build_dashboard(actual_rows, forecast_rows, date(2026, 1, 1), time(9, 20))
    intervals = result["selected_day"]["intervals"]

    assert intervals[0]["forecast_mw"] == 120
    assert intervals[1]["forecast_mw"] is None
    assert result["metrics"]["sample_count"] == 1


def test_dashboard_rejects_decision_date_outside_january_2026() -> None:
    with pytest.raises(ValueError, match="January 2026"):
        build_dashboard([], [], date(2026, 2, 1), time(9, 20))
