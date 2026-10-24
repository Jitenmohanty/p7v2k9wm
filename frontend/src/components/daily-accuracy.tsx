import type { DailyMetric } from '../types';
import { formatDay, formatMw } from '../format';

interface DailyAccuracyProps {
  days: DailyMetric[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

export function DailyAccuracy({ days, selectedDate, onSelect }: DailyAccuracyProps) {
  const maxMae = Math.max(...days.map((day) => day.mae_mw ?? 0), 1);
  return (
    <div className="daily-accuracy">
      <div className="daily-accuracy__scale" aria-hidden="true">
        <span>0 MW</span>
        <span>{formatMw(maxMae)} MW MAE</span>
      </div>
      <ol className="daily-accuracy__list" aria-label="Daily mean absolute error by decision date">
        {days.map((day) => {
          const value = day.mae_mw;
          const width = value === null ? 0 : Math.max((value / maxMae) * 100, 2);
          const label = `${formatDay(day.decision_date)} decision, ${value === null ? 'no paired data' : `${formatMw(value)} megawatts mean absolute error`}`;
          return (
            <li key={day.decision_date}>
              <button
                type="button"
                className={`day-row${day.decision_date === selectedDate ? ' day-row--selected' : ''}`}
                aria-label={label}
                aria-pressed={day.decision_date === selectedDate}
                onClick={() => onSelect(day.decision_date)}
              >
                <span className="day-row__date">{formatDay(day.decision_date)}</span>
                <span className="day-row__bar-track" aria-hidden="true">
                  <span className="day-row__bar" style={{ width: `${width}%` }} />
                </span>
                <span className="day-row__value">{value === null ? '—' : `${formatMw(value)} MW`}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
