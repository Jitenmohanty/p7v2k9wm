import type { IntervalPoint } from '../types';
import { formatMw } from '../format';

interface ForecastChartProps {
  points: IntervalPoint[];
  title: string;
}

const WIDTH = 820;
const HEIGHT = 280;
const PAD = { top: 20, right: 18, bottom: 36, left: 58 };

function makePath(values: Array<number | null>, min: number, max: number): string {
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const range = Math.max(max - min, 1);
  let drawing = false;
  const commands: string[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const x = PAD.left + (index / Math.max(values.length - 1, 1)) * plotWidth;
    const y = PAD.top + ((max - value) / range) * plotHeight;
    commands.push(`${drawing ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
    drawing = true;
  });
  return commands.join(' ');
}

export function ForecastChart({ points, title }: ForecastChartProps) {
  const allValues = points.flatMap((point) => [point.forecast_mw, point.actual_mw]).filter((value): value is number => value !== null);
  const high = allValues.length ? Math.max(...allValues) : 1000;
  const low = allValues.length ? Math.min(...allValues, 0) : 0;
  const max = high + Math.max((high - low) * 0.08, 100);
  const min = low;
  const yFor = (value: number) => PAD.top + ((max - value) / Math.max(max - min, 1)) * (HEIGHT - PAD.top - PAD.bottom);
  const yTicks = Array.from({ length: 4 }, (_, index) => max - ((max - min) * index) / 3);
  const tickIndices = [0, 12, 24, 36, 47];
  const actualPath = makePath(points.map((point) => point.actual_mw), min, max);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const forecastSamples = points.flatMap((point, index) => {
    if (point.forecast_mw === null) return [];
    const x = PAD.left + (index / Math.max(points.length - 1, 1)) * plotWidth;
    const y = PAD.top + ((max - point.forecast_mw) / Math.max(max - min, 1)) * plotHeight;
    return [{ x, y, time: point.local_time, generation: point.forecast_mw }];
  });

  return (
    <div className="forecast-chart">
      {points.length > 0 && (
        <svg className="forecast-chart__svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby="wind-chart-title wind-chart-description">
          <title id="wind-chart-title">{title}</title>
          <desc id="wind-chart-description">Hourly wind generation forecast samples at the decision cutoff compared with half-hourly actual generation, in megawatts. Forecast samples are shown at their reported start times without interpolation.</desc>
          {yTicks.map((tick, index) => {
            const y = yFor(tick);
            return (
              <g key={index}>
                <line className="chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} />
                <text className="chart-axis-label" x={PAD.left - 10} y={y + 4} textAnchor="end">{formatMw(tick)}</text>
              </g>
            );
          })}
          {tickIndices.map((index, tickIndex) => {
            const x = PAD.left + (index / Math.max(points.length - 1, 1)) * (WIDTH - PAD.left - PAD.right);
            return (
              <g key={index}>
                <line className="chart-grid chart-grid--vertical" x1={x} x2={x} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
                <text className="chart-axis-label" x={x} y={HEIGHT - 10} textAnchor={tickIndex === 0 ? 'start' : tickIndex === tickIndices.length - 1 ? 'end' : 'middle'}>
                  {tickIndex === 0 ? '00:00' : tickIndex === tickIndices.length - 1 ? '23:30' : points[index]?.local_time ?? ''}
                </text>
              </g>
            );
          })}
          <path d={actualPath} className="chart-line chart-line--actual" />
          {forecastSamples.map((sample) => (
            <circle key={sample.time} className="chart-forecast-point" cx={sample.x} cy={sample.y} r="3.4">
              <title>{`${sample.time} · forecast ${formatMw(sample.generation)} MW`}</title>
            </circle>
          ))}
        </svg>
      )}
      <div className="chart-legend" aria-hidden="true">
        <span><i className="legend-swatch legend-swatch--forecast" />Hourly forecast samples</span>
        <span><i className="legend-swatch legend-swatch--actual" />Actual generation</span>
      </div>
      <p className="sr-only">
        Chart data table follows with local time, forecast, actual generation, and forecast error for each half-hour interval.
      </p>
    </div>
  );
}
