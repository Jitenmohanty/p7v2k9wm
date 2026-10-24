interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  tone?: 'neutral' | 'warm' | 'cool';
}

export function MetricCard({ label, value, unit, detail, tone = 'neutral' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <h3>{label}</h3>
        <span className="metric-card__marker" aria-hidden="true" />
      </div>
      <p className="metric-card__value">
        {value}
        {unit && <span>{unit}</span>}
      </p>
      <p className="metric-card__detail">{detail}</p>
    </article>
  );
}
