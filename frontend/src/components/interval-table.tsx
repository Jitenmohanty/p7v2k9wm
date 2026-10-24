import type { IntervalPoint } from '../types';
import { formatMw, formatTimestamp } from '../format';

interface IntervalTableProps {
  points: IntervalPoint[];
}

export function IntervalTable({ points }: IntervalTableProps) {
  return (
    <div className="table-wrap" role="region" aria-label="Scrollable half-hourly wind generation comparison" tabIndex={0}>
      <table className="interval-table">
        <caption className="sr-only">Half-hourly wind forecast and actual generation for the selected delivery day</caption>
        <thead>
          <tr>
            <th scope="col">Start time</th>
            <th scope="col">Forecast (MW)</th>
            <th scope="col">Actual (MW)</th>
            <th scope="col">Error (MW)</th>
            <th scope="col">Forecast published</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.start_time}>
              <th scope="row">{point.local_time}</th>
              <td>{formatMw(point.forecast_mw)}</td>
              <td>{formatMw(point.actual_mw)}</td>
              <td className={point.error_mw === null ? '' : point.error_mw > 0 ? 'error-positive' : point.error_mw < 0 ? 'error-negative' : ''}>
                {point.error_mw === null ? '—' : `${point.error_mw > 0 ? '+' : ''}${formatMw(point.error_mw)}`}
                <span className="sr-only">{point.error_mw !== null && point.error_mw > 0 ? ' over-forecast' : point.error_mw !== null && point.error_mw < 0 ? ' under-forecast' : ''}</span>
              </td>
              <td>{point.publish_time ? formatTimestamp(point.publish_time) : 'No forecast point by cutoff'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
