import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from './App';
import { fetchDashboard } from './api';
import type { DashboardResponse } from './types';

vi.mock('./api', () => ({ fetchDashboard: vi.fn() }));

const response: DashboardResponse = {
  period: {
    decision_start: '2026-01-01',
    decision_end: '2026-01-31',
    timezone: 'Europe/London',
    cutoff_time: '09:20',
    market_reference: 'GB day-ahead 60-minute auction reference cutoff',
  },
  metrics: {
    sample_count: 2,
    expected_count: 1488,
    coverage_pct: 0.13,
    mae_mw: 120,
    rmse_mw: 140,
    bias_mw: 35,
    wape_pct: 2.4,
    overforecast_pct: 50,
  },
  daily_metrics: [
    { decision_date: '2026-01-01', delivery_date: '2026-01-02', sample_count: 2, coverage_pct: 4.2, mae_mw: 120, bias_mw: 35 },
    { decision_date: '2026-01-02', delivery_date: '2026-01-03', sample_count: 0, coverage_pct: 0, mae_mw: null, bias_mw: null },
  ],
  selected_day: {
    decision_date: '2026-01-15',
    delivery_date: '2026-01-16',
    forecast_issue_from: '2026-01-15T08:30:00Z',
    forecast_issue_to: '2026-01-15T08:30:00Z',
    intervals: [
      { start_time: '2026-01-16T00:00:00Z', local_time: '00:00', forecast_mw: 1400, actual_mw: 1365, error_mw: 35, publish_time: '2026-01-15T08:30:00Z' },
    ],
  },
  sources: ['Elexon BMRS Insights FUELHH (WIND)', 'Elexon BMRS Insights WINDFOR'],
  error_definition: 'forecast_mw - actual_mw; positive means wind was over-forecast',
};

describe('Wind Outlook dashboard', () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.mocked(fetchDashboard).mockResolvedValue(response));

  it('renders the forecast review, metrics, and accessible interval details', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Forecast outlook' })).toBeInTheDocument();
    expect(screen.getByText('Mean absolute error')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Wind generation profile' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /half-hourly wind forecast and actual generation/i })).toBeInTheDocument();
    expect(screen.getByText('Positive error = wind over-forecast')).toBeInTheDocument();
  });

  it('reloads the analysis when the user selects a different decision date', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Forecast outlook' });
    await user.selectOptions(screen.getByLabelText('Decision date'), '2026-01-01');

    await waitFor(() => expect(fetchDashboard).toHaveBeenLastCalledWith('2026-01-01', '09:20', expect.any(AbortSignal)));
  });

  it('shows a useful retry action when the API is unavailable', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDashboard).mockRejectedValueOnce(new Error('Elexon data is temporarily unavailable.'));
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Elexon data is temporarily unavailable.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Wind generation profile' })).toBeInTheDocument();
  });

  it('has no automatable WCAG A/AA violations in the loaded dashboard', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Wind generation profile' });

    const results = await axe.run(document.body, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      // jsdom has no layout engine for the color contrast rule; check contrast in the browser.
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
});
