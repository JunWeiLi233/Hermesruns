export default function MetricCard({ label, value, hint, tone = 'default', className = '' }) {
  const classes = ['metric-card', `metric-card--${tone}`, className].filter(Boolean).join(' ');
  return (
    <article className={classes}>
      <span className="metric-card-label">{label}</span>
      <strong className="metric-card-value">{value}</strong>
      {hint ? <span className="metric-card-hint">{hint}</span> : null}
    </article>
  );
}
