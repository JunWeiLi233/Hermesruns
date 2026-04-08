export default function CardLoadingState({
  lines = 3,
  className = '',
}) {
  const classes = ['card-loading-state', className].filter(Boolean).join(' ');
  const safeLines = Math.max(2, Number(lines) || 3);

  return (
    <div className={classes} aria-hidden="true">
      <div className="card-loading-state__badge" />
      <div className="card-loading-state__title" />
      <div className="card-loading-state__copy" />
      <div className="card-loading-state__list">
        {Array.from({ length: safeLines }).map((_, index) => (
          <span key={index} className="card-loading-state__line" />
        ))}
      </div>
    </div>
  );
}
