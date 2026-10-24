import { useEffect, useState } from 'react';
import { fetchDashboard } from './api';
import { formatDay, formatMw, formatPercent, formatTimestamp } from './format';
import { BrandMark } from './components/brand-mark';
import { DailyAccuracy } from './components/daily-accuracy';
import { ForecastChart } from './components/forecast-chart';
import { IntervalTable } from './components/interval-table';
import { MetricCard } from './components/metric-card';
import type { DashboardResponse } from './types';

const INITIAL_DECISION_DATE = '2026-01-15';

function App() {
  const [decisionDate, setDecisionDate] = useState(INITIAL_DECISION_DATE);
  const [cutoffTime, setCutoffTime] = useState('09:20');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    fetchDashboard(decisionDate, cutoffTime, controller.signal)
      .then((response) => setData(response))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'The dashboard could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [decisionDate, cutoffTime, refreshIndex]);

  const selectedDay = data?.selected_day;
  const dailyAccuracy = data?.daily_metrics ?? [];
  const hasObservations = (data?.metrics.sample_count ?? 0) > 0;
  const bias = data?.metrics.bias_mw ?? null;
  const biasDetail = bias === null
    ? 'No paired intervals yet'
    : bias > 0
      ? 'Average wind over-forecast'
      : bias < 0
        ? 'Average wind under-forecast'
        : 'No average directional bias';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Gridbricks Wind Outlook home">
          <BrandMark />
          <span className="brand__text"><strong>gridbricks</strong><small>ENERGY INTELLIGENCE</small></span>
        </a>
        <div className="sidebar__label">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          <a className="nav-item nav-item--active" href="#overview" aria-current="page">
            <span className="nav-icon nav-icon--overview" aria-hidden="true" />Overview
          </a>
          <a className="nav-item" href="#accuracy">
            <span className="nav-icon nav-icon--accuracy" aria-hidden="true" />Accuracy review
          </a>
          <a className="nav-item" href="#data-notes">
            <span className="nav-icon nav-icon--sources" aria-hidden="true" />Data notes
          </a>
        </nav>
        <div className="sidebar__bottom">
          <span className="sidebar__eyebrow">PILOT WORKSPACE</span>
          <p>National wind forecast<br />Day-ahead decision support</p>
          <div className="sidebar__version"><span /> January 2026 replay</div>
        </div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>Gridbricks</span><b aria-hidden="true">/</b><strong>Wind Outlook</strong></div>
          <div className="topbar__right"><span className="topbar__period">PILOT · GB NATIONAL</span><span className="avatar" aria-hidden="true">GB</span></div>
        </header>

        <main id="main-content" className="main-content">
          <section id="overview" className="page-heading" aria-labelledby="page-title">
            <div>
              <p className="eyebrow">DAY-AHEAD PROCUREMENT · WIND</p>
              <h1 id="page-title">Forecast outlook</h1>
              <p className="page-heading__intro">See the wind generation forecast available at decision time, then measure it against the outturn.</p>
            </div>
            <div className="source-chip"><span className="source-chip__dot" /> Elexon BMRS source</div>
          </section>

          <section className="control-strip" aria-label="Decision view settings">
            <div className="control-strip__context">
              <span className="control-strip__icon" aria-hidden="true">D−1</span>
              <div><strong>January 2026 replay</strong><span>Decision date → delivery on the following day</span></div>
            </div>
            <div className="control-fields">
              <div className="field-group">
                <label htmlFor="decision-date">Decision date</label>
                <select id="decision-date" value={decisionDate} onChange={(event) => setDecisionDate(event.target.value)}>
                  {dailyAccuracy.map((day) => <option key={day.decision_date} value={day.decision_date}>{formatDay(day.decision_date, { day: '2-digit', month: 'long', year: 'numeric' })}</option>)}
                  {dailyAccuracy.length === 0 && <option value={decisionDate}>{formatDay(decisionDate, { day: '2-digit', month: 'long', year: 'numeric' })}</option>}
                </select>
              </div>
              <div className="field-group field-group--time">
                <label htmlFor="cutoff-time">Forecast cutoff</label>
                <div className="time-input-wrap"><input id="cutoff-time" type="time" value={cutoffTime} onChange={(event) => setCutoffTime(event.target.value)} /><span>UK time</span></div>
              </div>
            </div>
          </section>

          {error && (
            <div className="notice notice--error" role="alert">
              <div><strong>Forecast data didn’t load</strong><p>{error}</p></div>
              <button type="button" className="button button--secondary" onClick={() => setRefreshIndex((index) => index + 1)}>Try again</button>
            </div>
          )}

          {loading && !data && (
            <div className="loading-state" role="status" aria-live="polite">
              <span className="loading-state__line" />
              <span>Loading January forecast and actual data from Elexon…</span>
            </div>
          )}

          {data && (
            <>
              <section className="metrics-grid" aria-labelledby="metrics-title" aria-busy={loading}>
                <h2 id="metrics-title" className="sr-only">January 2026 forecast accuracy summary</h2>
                <MetricCard label="Mean absolute error" value={formatMw(data.metrics.mae_mw)} unit="MW" detail="Typical interval miss" tone="cool" />
                <MetricCard label="Root mean square error" value={formatMw(data.metrics.rmse_mw)} unit="MW" detail="Penalises larger misses" />
                <MetricCard label="Forecast bias" value={bias === null ? '—' : `${bias > 0 ? '+' : ''}${formatMw(bias)}`} unit="MW" detail={biasDetail} tone={bias !== null && bias > 0 ? 'warm' : 'neutral'} />
                <MetricCard label="Weighted absolute error" value={formatPercent(data.metrics.wape_pct)} detail="Absolute error ÷ actual wind" />
                <MetricCard label="Data coverage" value={formatPercent(data.metrics.coverage_pct)} detail={`${data.metrics.sample_count.toLocaleString('en-GB')} of ${data.metrics.expected_count.toLocaleString('en-GB')} intervals matched`} />
              </section>

              {!hasObservations && !loading && (
                <div className="notice notice--empty" role="status">
                  <strong>No matched intervals in this response.</strong>
                  <p>The source may have no records for this window. Try refreshing, or check the Elexon data availability.</p>
                </div>
              )}

              <div className="analysis-grid">
                <section className="panel forecast-panel" aria-labelledby="forecast-title">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">SELECTED DELIVERY DAY</p>
                      <h2 id="forecast-title">Wind generation profile</h2>
                    </div>
                    <div className="delivery-date"><span>DELIVERY DATE</span><strong>{selectedDay ? formatDay(selectedDay.delivery_date, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</strong></div>
                  </div>
                  <div className="issue-note">
                    <span className="issue-note__icon" aria-hidden="true">↗</span>
                    <p><strong>As available by {data.period.cutoff_time} UK time</strong><span>Forecast issue range: {selectedDay ? `${formatTimestamp(selectedDay.forecast_issue_from)} – ${formatTimestamp(selectedDay.forecast_issue_to)}` : '—'}</span></p>
                    <span className="issue-note__tag">D−1 SNAPSHOT</span>
                  </div>
                  <ForecastChart points={selectedDay?.intervals ?? []} title={`Wind forecast and actual for delivery ${selectedDay?.delivery_date ?? ''}`} />
                  <div className="chart-footnote"><span>MW · hourly forecast points / 30-minute actuals</span><span>Positive error = wind over-forecast</span></div>
                </section>

                <aside className="panel insight-panel" aria-labelledby="insight-title">
                  <div className="insight-panel__top"><span className="insight-glyph" aria-hidden="true">↗</span><span className="eyebrow">DECISION CONTEXT</span></div>
                  <h2 id="insight-title">Wind forecast risk</h2>
                  <p className="insight-panel__copy">A positive forecast error means the forecast showed more wind than arrived. That can leave less renewable generation available than planned.</p>
                  <div className="insight-stat">
                    <div><span>Intervals over-forecast</span><strong>{formatPercent(data.metrics.overforecast_pct, 0)}</strong></div>
                    <div className="insight-stat__track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(data.metrics.overforecast_pct ?? 0, 100))}%` }} /></div>
                    <small>Across matched January decision intervals</small>
                  </div>
                  <div className="insight-rule" />
                  <p className="insight-panel__limit"><strong>Scope of this pilot</strong>Wind-only data is shown here. Demand and other generation are not included, so this view does not calculate a total procurement gap.</p>
                </aside>
              </div>

              <section id="accuracy" className="panel accuracy-panel" aria-labelledby="accuracy-title">
                <div className="panel-heading panel-heading--tight">
                  <div><p className="eyebrow">DAY-BY-DAY REVIEW</p><h2 id="accuracy-title">Accuracy across decision dates</h2></div>
                  <p className="panel-heading__aside">Select a date to inspect its delivery profile</p>
                </div>
                <DailyAccuracy days={data.daily_metrics} selectedDate={decisionDate} onSelect={setDecisionDate} />
              </section>

              <section className="panel intervals-panel" aria-labelledby="intervals-title">
                <div className="panel-heading panel-heading--tight">
                  <div><p className="eyebrow">HALF-HOURLY DETAIL</p><h2 id="intervals-title">Interval comparison</h2></div>
                  <span className="record-count">{selectedDay?.intervals.length ?? 0} periods</span>
                </div>
                <IntervalTable points={selectedDay?.intervals ?? []} />
              </section>

              <section id="data-notes" className="data-notes" aria-labelledby="data-notes-title">
                <div><p className="eyebrow">METHOD & SOURCES</p><h2 id="data-notes-title">A transparent forecast replay</h2></div>
                <div className="data-notes__body">
                  <p>For each delivery interval, the analysis selects the latest WINDFOR publication at or before the chosen decision cutoff. It then matches that forecast to FUELHH actual generation by the same start time. Error is forecast minus actual.</p>
                  <p>WINDFOR provides hourly samples while FUELHH actuals are half-hourly. Only exact start-time matches are scored; no values are interpolated. The coverage metric makes the resulting unmatched half-hours visible.</p>
                  <p><strong>Sources:</strong> {data.sources.join(' · ')}. Displayed times use Europe/London. January 2026 has 48 half-hour periods per day.</p>
                </div>
              </section>
            </>
          )}

          <footer className="page-footer"><span>GRIDBRICKS · WIND OUTLOOK</span><span>January 2026 historical replay · National wind only</span></footer>
        </main>
      </div>
    </div>
  );
}

export default App;
