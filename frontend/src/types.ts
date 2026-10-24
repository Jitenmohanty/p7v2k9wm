export interface Metrics {
  sample_count: number;
  expected_count: number;
  coverage_pct: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  wape_pct: number | null;
  overforecast_pct: number | null;
}

export interface DailyMetric {
  decision_date: string;
  delivery_date: string;
  sample_count: number;
  coverage_pct: number;
  mae_mw: number | null;
  bias_mw: number | null;
}

export interface IntervalPoint {
  start_time: string;
  local_time: string;
  forecast_mw: number | null;
  actual_mw: number | null;
  error_mw: number | null;
  publish_time: string | null;
}

export interface SelectedDay {
  decision_date: string;
  delivery_date: string;
  forecast_issue_from: string | null;
  forecast_issue_to: string | null;
  intervals: IntervalPoint[];
}

export interface DashboardResponse {
  period: {
    decision_start: string;
    decision_end: string;
    timezone: string;
    cutoff_time: string;
    market_reference: string;
  };
  metrics: Metrics;
  daily_metrics: DailyMetric[];
  selected_day: SelectedDay;
  sources: string[];
  error_definition: string;
}
