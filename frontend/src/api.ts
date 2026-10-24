import type { DashboardResponse } from './types';

export async function fetchDashboard(
  decisionDate: string,
  cutoffTime: string,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  const params = new URLSearchParams({ decision_date: decisionDate, cutoff_time: cutoffTime });
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const response = await fetch(`${baseUrl}/api/dashboard?${params.toString()}`, { signal });
  if (!response.ok) {
    let message = 'The Elexon data service could not be reached.';
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // Keep the clear fallback message when the server response is not JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as DashboardResponse;
}
