export default function PremiumEmptyState({
  icon = 'i',
  title,
  copy,
  helper = '',
  actionLabel = '',
  onAction = null,
  className = '',
  compact = false,
}) {
  const classes = ['premium-empty-state', compact ? 'premium-empty-state--compact' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="premium-empty-state__icon" aria-hidden="true">{icon}</div>
      {title ? <h3 className="premium-empty-state__heading">{title}</h3> : null}
      {copy ? <p className="premium-empty-state__copy">{copy}</p> : null}
      {helper ? <p className="premium-empty-state__helper">{helper}</p> : null}
      {actionLabel && typeof onAction === 'function' ? (
        <button type="button" className="btn-secondary premium-empty-state__action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
