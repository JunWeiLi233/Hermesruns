const cx = (...parts) => parts.filter(Boolean).join(' ');

function resolveActiveItem(navItems, activeLabel) {
  return navItems.find((item) => item?.active)
    || navItems.find((item) => item?.label === activeLabel)
    || null;
}

export default function RunnerShellTopNav({
  navItems = [],
  activeLabel,
  parentLabel,
  parentRoute,
  navigate,
  className,
  children,
}) {
  const normalizedItems = Array.isArray(navItems)
    ? navItems.filter((item) => item?.label && item?.route)
    : [];
  const activeItem = resolveActiveItem(normalizedItems, activeLabel);
  const currentLabel = activeLabel || activeItem?.label || 'Hermes';
  const dashboardItem = normalizedItems.find((item) => item.key === 'dashboard');

  function handleRoute(route) {
    if (!route || typeof navigate !== 'function') return;
    navigate(route);
  }

  return (
    <div className={cx('runner-shell-topnav runner-shell-topnav--command', className)}>
      <div className="runner-shell-topnav-identity">
        <button
          type="button"
          className="runner-shell-topnav-brand"
          onClick={() => handleRoute(dashboardItem?.route || '/profile')}
          aria-label={dashboardItem?.label || 'HERMES'}
        >
          HERMES
        </button>
        <div className="runner-shell-topnav-current-stack">
          {parentLabel ? (
            <button
              type="button"
              className="runner-shell-topnav-crumb"
              onClick={() => handleRoute(parentRoute || activeItem?.route)}
            >
              {parentLabel}
            </button>
          ) : null}
          <strong>{currentLabel}</strong>
        </div>
      </div>

      {children ? <div className="runner-shell-topnav-meta">{children}</div> : null}
    </div>
  );
}
