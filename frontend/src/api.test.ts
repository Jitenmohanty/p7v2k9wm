import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDashboard } from './api';

describe('fetchDashboard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the decision date and cutoff to the backend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ metrics: {}, selected_day: {}, daily_metrics: [], period: {}, sources: [], error_definition: '' }), { status: 200 }),
    );

    await fetchDashboard('2026-01-15', '09:20');

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard?decision_date=2026-01-15&cutoff_time=09%3A20', { signal: undefined });
  });

  it('surfaces the backend error detail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ detail: 'Elexon is unavailable.' }), { status: 502 }));

    await expect(fetchDashboard('2026-01-15', '09:20')).rejects.toThrow('Elexon is unavailable.');
  });
});
