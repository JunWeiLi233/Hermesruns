import React from 'react';
import shoeSkeletonAsset from '../assets/generated/run-gait-v2/evo-sl-side-master.webp';

function SkeletonBlock({ className = '', style }) {
  return <span className={`page-skeleton__block ${className}`.trim()} style={style} aria-hidden="true" />;
}

function SkeletonPanel({ className = '', children }) {
  return <section className={`page-skeleton__panel ${className}`.trim()} aria-hidden="true">{children}</section>;
}

function SkeletonLines({ count = 3, className = '' }) {
  return (
    <div className={`page-skeleton__lines ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonBlock key={index} className={index === count - 1 ? 'page-skeleton__line--short' : ''} />
      ))}
    </div>
  );
}

function SkeletonStats({ count = 3, className = '' }) {
  return (
    <div className={`page-skeleton__stat-grid ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonPanel key={index} className="page-skeleton__stat-card">
          <SkeletonBlock className="page-skeleton__stat-label" />
          <SkeletonBlock className="page-skeleton__stat-value" />
          <SkeletonBlock className="page-skeleton__stat-note" />
        </SkeletonPanel>
      ))}
    </div>
  );
}

function SkeletonRows({ count = 4, className = '' }) {
  return (
    <div className={`page-skeleton__rows ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="page-skeleton__row">
          <SkeletonBlock className="page-skeleton__row-icon" />
          <div className="page-skeleton__row-copy">
            <SkeletonBlock />
            <SkeletonBlock className="page-skeleton__line--short" />
          </div>
          <SkeletonBlock className="page-skeleton__row-value" />
        </div>
      ))}
    </div>
  );
}

function RunnerFrame({ variant, children }) {
  const rootClassName = ['page-skeleton', 'page-skeleton--runner', `page-skeleton--${variant}`].join(' ');
  const activeNavIndex = {
    profile: 0,
    analysis: 1,
    runs: 2,
    heatmap: 3,
    weather: 4,
    shoes: 5,
    'shoe-catalog': 5,
    races: 6,
    'race-detail': 6,
    schedule: 7,
    'muscle-training': 8,
  }[variant];

  return (
    <div className={rootClassName} role="status" aria-live="polite" aria-busy="true" aria-label="Loading page">
      <aside className="page-skeleton__rail" aria-hidden="true">
        <div className="page-skeleton__brand-row">
          <SkeletonBlock className="page-skeleton__brand" />
          <SkeletonBlock className="page-skeleton__rail-toggle" />
        </div>
        <SkeletonBlock className="page-skeleton__brand-subline" />
        <div className="page-skeleton__rail-links">
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className={`page-skeleton__rail-item${index === activeNavIndex ? ' page-skeleton__rail-item--active' : ''}`}>
              <SkeletonBlock className="page-skeleton__rail-icon" />
              <SkeletonBlock className="page-skeleton__rail-label" />
              <SkeletonBlock className="page-skeleton__rail-index" />
            </div>
          ))}
        </div>
        <div className="page-skeleton__rail-footer">
          <SkeletonBlock className="page-skeleton__rail-footer-icon" />
          <SkeletonBlock className="page-skeleton__rail-footer-label" />
        </div>
      </aside>
      <main className="page-skeleton__main">
        <header className="page-skeleton__topbar" aria-hidden="true">
          <div className="page-skeleton__topbar-left">
            <SkeletonBlock className="page-skeleton__crumb page-skeleton__topbar-pill" />
          </div>
          <div className="page-skeleton__topbar-actions">
            <SkeletonBlock className="page-skeleton__topbar-action" />
            <SkeletonBlock className="page-skeleton__topbar-action page-skeleton__topbar-action--settings" />
            <SkeletonBlock className="page-skeleton__avatar" />
          </div>
        </header>
        <section className="page-skeleton__canvas">{children}</section>
      </main>
    </div>
  );
}

function AdminPageSkeleton() {
  return (
    <div className="page-skeleton page-skeleton--admin" role="status" aria-live="polite" aria-busy="true" aria-label="Loading page">
      <div className="page-skeleton__admin-layout" aria-hidden="true">
        <aside className="page-skeleton__admin-sidebar">
          <div className="page-skeleton__admin-brand">
            <SkeletonBlock className="page-skeleton__admin-wordmark" />
            <SkeletonBlock className="page-skeleton__admin-brand-copy" />
          </div>
          <div className="page-skeleton__admin-nav">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className={`page-skeleton__admin-nav-item${index === 0 ? ' page-skeleton__admin-nav-item--active' : ''}`}>
                <SkeletonBlock className="page-skeleton__admin-nav-icon" />
                <div><SkeletonBlock className="page-skeleton__admin-nav-label" /><SkeletonBlock className="page-skeleton__admin-nav-copy" /></div>
                <SkeletonBlock className="page-skeleton__admin-nav-index" />
              </div>
            ))}
          </div>
          <div className="page-skeleton__admin-status"><SkeletonBlock /><SkeletonBlock /></div>
          <SkeletonBlock className="page-skeleton__admin-sidebar-action" />
        </aside>
        <main className="page-skeleton__admin-main">
          <header className="page-skeleton__admin-topbar">
            <div><SkeletonBlock className="page-skeleton__eyebrow" /><SkeletonBlock className="page-skeleton__admin-topbar-title" /><SkeletonBlock className="page-skeleton__admin-topbar-copy" /></div>
            <div className="page-skeleton__admin-topbar-actions"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
          </header>
          <SkeletonPanel className="page-skeleton__admin-hero"><div className="page-skeleton__section-heading"><SkeletonBlock className="page-skeleton__eyebrow" /><SkeletonBlock className="page-skeleton__title" /><SkeletonBlock className="page-skeleton__copy" /></div><SkeletonBlock className="page-skeleton__hero-art page-skeleton__hero-art--terminal" /></SkeletonPanel>
          <SkeletonStats count={4} />
          <SkeletonPanel className="page-skeleton__admin-table"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={6} /></SkeletonPanel>
        </main>
      </div>
    </div>
  );
}

function HeatmapPageSkeleton() {
  return (
    <div className="page-skeleton page-skeleton--heatmap-page" role="status" aria-live="polite" aria-busy="true" aria-label="Loading page">
      <div className="page-skeleton__heatmap-map-shell" aria-hidden="true">
        <header className="page-skeleton__heatmap-topbar">
          <div className="page-skeleton__heatmap-brand"><SkeletonBlock /><SkeletonBlock /></div>
          <div className="page-skeleton__heatmap-search"><SkeletonBlock /><SkeletonBlock /></div>
          <div className="page-skeleton__heatmap-actions"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
        </header>
        <SkeletonBlock className="page-skeleton__heatmap-recenter" />
        <SkeletonBlock className="page-skeleton__heatmap-canvas" />
        <aside className="page-skeleton__heatmap-legend">
          <SkeletonBlock className="page-skeleton__heatmap-card-kicker" />
          <div className="page-skeleton__heatmap-legend-scale">{Array.from({ length: 5 }, (_, index) => <SkeletonBlock key={index} />)}</div>
          <div className="page-skeleton__heatmap-legend-meta"><SkeletonBlock /><SkeletonBlock /></div>
        </aside>
        <div className="page-skeleton__heatmap-utility-rail">{Array.from({ length: 7 }, (_, index) => <SkeletonBlock key={index} />)}</div>
        <SkeletonPanel className="page-skeleton__heatmap-sessions">
          <SkeletonBlock className="page-skeleton__heatmap-card-kicker" />
          <div className="page-skeleton__heatmap-session-stats">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div>
          <SkeletonRows count={3} />
        </SkeletonPanel>
      </div>
    </div>
  );
}

function RunnerPageSkeleton({ variant = 'runner' }) {
  if (variant === 'admin') return <AdminPageSkeleton />;
  if (variant === 'heatmap') return <HeatmapPageSkeleton />;

  const commonHeader = (
    <div className="page-skeleton__section-heading" aria-hidden="true">
      <SkeletonBlock className="page-skeleton__eyebrow" />
      <SkeletonBlock className="page-skeleton__title" />
      <SkeletonBlock className="page-skeleton__copy" />
    </div>
  );

  if (variant === 'profile') {
    return <RunnerFrame variant={variant}>
      <div className="page-skeleton__profile-content">
        <div className="page-skeleton__profile-editorial-hero">
          <div>
            <SkeletonBlock className="page-skeleton__profile-date" />
            <SkeletonBlock className="page-skeleton__profile-greeting" />
          </div>
          <div className="page-skeleton__profile-readiness">
            <SkeletonBlock className="page-skeleton__profile-readiness-ring" />
            <div className="page-skeleton__profile-readiness-copy"><SkeletonBlock /><SkeletonBlock /></div>
          </div>
        </div>

        <SkeletonPanel className="page-skeleton__profile-comeback">
          <div className="page-skeleton__profile-comeback-body">
            <SkeletonBlock className="page-skeleton__profile-comeback-eyebrow" />
            <SkeletonBlock className="page-skeleton__profile-comeback-title" />
            <SkeletonLines count={2} className="page-skeleton__profile-comeback-copy" />
            <div className="page-skeleton__profile-comeback-actions"><SkeletonBlock /><SkeletonBlock /></div>
          </div>
          <SkeletonBlock className="page-skeleton__profile-comeback-orb" />
        </SkeletonPanel>

        <SkeletonPanel className="page-skeleton__profile-today">
          <div className="page-skeleton__profile-today-content">
            <SkeletonBlock className="page-skeleton__profile-today-kicker" />
            <SkeletonBlock className="page-skeleton__profile-today-title" />
            <SkeletonLines count={2} className="page-skeleton__profile-today-copy" />
            <div className="page-skeleton__profile-today-stats"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
            <div className="page-skeleton__profile-today-actions"><SkeletonBlock /><SkeletonBlock /></div>
          </div>
        </SkeletonPanel>

        <div className="page-skeleton__profile-metric-strip">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonPanel key={index} className="page-skeleton__profile-metric-card">
              <div className="page-skeleton__profile-metric-head"><SkeletonBlock className="page-skeleton__profile-metric-icon" /><SkeletonBlock className="page-skeleton__profile-metric-kicker" /></div>
              <SkeletonBlock className="page-skeleton__profile-metric-value" />
              <div className="page-skeleton__profile-metric-detail"><SkeletonBlock /><SkeletonBlock /></div>
            </SkeletonPanel>
          ))}
        </div>

        <div className="page-skeleton__profile-training-grid">
          <SkeletonPanel className="page-skeleton__profile-weekly-card">
            <div className="page-skeleton__profile-card-head"><div><SkeletonBlock className="page-skeleton__profile-card-kicker" /><SkeletonBlock className="page-skeleton__profile-card-title" /></div><div className="page-skeleton__profile-legend"><SkeletonBlock /><SkeletonBlock /></div></div>
            <div className="page-skeleton__profile-weekly-bars">{Array.from({ length: 7 }, (_, index) => <div key={index} className="page-skeleton__profile-weekly-bar-col"><div className="page-skeleton__profile-weekly-bar-track"><SkeletonBlock className="page-skeleton__profile-weekly-bar page-skeleton__profile-weekly-bar--projected" /><SkeletonBlock className="page-skeleton__profile-weekly-bar page-skeleton__profile-weekly-bar--actual" /></div><SkeletonBlock className="page-skeleton__profile-weekly-label" /></div>)}</div>
          </SkeletonPanel>
          <SkeletonPanel className="page-skeleton__profile-sessions-card">
            <div className="page-skeleton__profile-card-head"><div><SkeletonBlock className="page-skeleton__profile-card-kicker" /><SkeletonBlock className="page-skeleton__profile-card-title" /></div></div>
            <div className="page-skeleton__profile-session-list">{Array.from({ length: 5 }, (_, index) => <div key={index} className="page-skeleton__profile-session-row"><SkeletonBlock className="page-skeleton__profile-session-dot" /><div><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock className="page-skeleton__profile-session-value" /></div>)}</div>
            <SkeletonBlock className="page-skeleton__profile-session-link" />
          </SkeletonPanel>
        </div>

        <SkeletonPanel className="page-skeleton__profile-progression">
          <div className="page-skeleton__profile-card-head"><div><SkeletonBlock className="page-skeleton__profile-card-kicker" /><SkeletonBlock className="page-skeleton__profile-card-title" /></div><div className="page-skeleton__profile-tabs">{Array.from({ length: 5 }, (_, index) => <SkeletonBlock key={index} />)}</div></div>
          <div className="page-skeleton__profile-progression-summary"><SkeletonBlock className="page-skeleton__profile-progression-total" /><div>{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div></div>
          <SkeletonBlock className="page-skeleton__profile-progression-chart" />
        </SkeletonPanel>

        <SkeletonPanel className="page-skeleton__profile-digest"><div className="page-skeleton__profile-card-head"><div><SkeletonBlock className="page-skeleton__profile-card-kicker" /><SkeletonBlock className="page-skeleton__profile-card-title" /></div></div><SkeletonLines count={3} /></SkeletonPanel>

        <div className="page-skeleton__profile-bottom-grid">
          {Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__profile-bottom-card"><div className="page-skeleton__profile-card-head"><div><SkeletonBlock className="page-skeleton__profile-card-kicker" /><SkeletonBlock className="page-skeleton__profile-card-title" /></div></div><SkeletonRows count={index === 0 ? 3 : 4} /></SkeletonPanel>)}
        </div>

        <SkeletonPanel className="page-skeleton__profile-rewards">
          <div className="page-skeleton__profile-rewards-head">
            <div>
              <SkeletonBlock className="page-skeleton__profile-card-kicker" />
              <SkeletonBlock className="page-skeleton__profile-card-title" />
            </div>
            <SkeletonBlock className="page-skeleton__profile-rewards-link" />
          </div>
          <div className="page-skeleton__profile-rewards-hero">
            <div className="page-skeleton__profile-rewards-progress">
              <SkeletonBlock className="page-skeleton__profile-rewards-ring" />
              <div className="page-skeleton__profile-rewards-progress-copy">
                <SkeletonBlock />
                <SkeletonBlock />
              </div>
            </div>
            <div className="page-skeleton__profile-rewards-next">
              <SkeletonBlock className="page-skeleton__profile-rewards-tag" />
              <SkeletonBlock className="page-skeleton__profile-rewards-icon" />
              <SkeletonBlock className="page-skeleton__profile-rewards-next-title" />
              <SkeletonLines count={2} />
              <div className="page-skeleton__profile-rewards-meter">
                <SkeletonBlock />
                <SkeletonBlock />
              </div>
            </div>
          </div>
          <div className="page-skeleton__profile-rewards-badges">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="page-skeleton__profile-reward-badge">
                <SkeletonBlock className="page-skeleton__profile-reward-badge-icon" />
                <div><SkeletonBlock /><SkeletonBlock /></div>
              </div>
            ))}
          </div>
        </SkeletonPanel>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'runs') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__runs-cockpit">
        <div className="page-skeleton__runs-cockpit-primary">
          <div>
            <SkeletonBlock className="page-skeleton__runs-kicker" />
            <SkeletonBlock className="page-skeleton__runs-title" />
            <SkeletonLines count={2} className="page-skeleton__runs-copy" />
          </div>
          <div className="page-skeleton__runs-actions">
            <SkeletonBlock className="page-skeleton__runs-action page-skeleton__runs-action--primary" />
            <SkeletonBlock className="page-skeleton__runs-action" />
          </div>
        </div>
        <div className="page-skeleton__runs-cockpit-rail">
          <SkeletonPanel className="page-skeleton__runs-signal page-skeleton__runs-signal--count">
            <SkeletonBlock className="page-skeleton__runs-signal-label" />
            <SkeletonBlock className="page-skeleton__runs-signal-value" />
            <SkeletonBlock className="page-skeleton__runs-signal-note" />
          </SkeletonPanel>
          <SkeletonPanel className="page-skeleton__runs-signal">
            <SkeletonBlock className="page-skeleton__runs-signal-label" />
            <SkeletonBlock className="page-skeleton__runs-signal-value" />
            <SkeletonBlock className="page-skeleton__runs-signal-note" />
          </SkeletonPanel>
          <SkeletonPanel className="page-skeleton__runs-signal page-skeleton__runs-signal--status">
            <SkeletonBlock className="page-skeleton__runs-signal-label" />
            <SkeletonBlock className="page-skeleton__runs-signal-value" />
            <SkeletonBlock className="page-skeleton__runs-signal-note" />
          </SkeletonPanel>
        </div>
      </SkeletonPanel>
      <SkeletonPanel className="page-skeleton__runs-workbench">
        <SkeletonBlock className="page-skeleton__runs-search" />
        <div className="page-skeleton__runs-chip-row">
          {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className={`page-skeleton__runs-chip${index === 0 ? ' page-skeleton__runs-chip--active' : ''}`} />)}
        </div>
        <div className="page-skeleton__runs-chip-row page-skeleton__runs-chip-row--secondary">
          {Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} className="page-skeleton__runs-chip" />)}
        </div>
      </SkeletonPanel>
      <SkeletonStats count={3} className="page-skeleton__runs-stats" />
      <div className="page-skeleton__runs-insight-strip">
        <SkeletonPanel className="page-skeleton__runs-insight page-skeleton__runs-insight--primary"><SkeletonBlock className="page-skeleton__runs-insight-label" /><SkeletonBlock className="page-skeleton__runs-insight-value" /><SkeletonBlock className="page-skeleton__runs-insight-note" /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__runs-insight"><SkeletonBlock className="page-skeleton__runs-insight-label" /><SkeletonBlock className="page-skeleton__runs-insight-value" /><SkeletonBlock className="page-skeleton__runs-insight-note" /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__runs-insight"><SkeletonBlock className="page-skeleton__runs-insight-label" /><SkeletonBlock className="page-skeleton__runs-insight-value" /><SkeletonBlock className="page-skeleton__runs-insight-note" /></SkeletonPanel>
      </div>
      <div className="page-skeleton__runs-history">
        <SkeletonBlock className="page-skeleton__runs-history-title" />
        <SkeletonBlock className="page-skeleton__runs-history-meta" />
        <SkeletonPanel className="page-skeleton__runs-month">
          <div className="page-skeleton__runs-month-header"><SkeletonBlock className="page-skeleton__runs-month-chevron" /><SkeletonBlock className="page-skeleton__runs-month-label" /><SkeletonBlock className="page-skeleton__runs-month-meta" /></div>
          <div className="page-skeleton__runs-card-grid">
            {Array.from({ length: 2 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__runs-card"><SkeletonBlock className="page-skeleton__runs-card-thumb" /><div className="page-skeleton__runs-card-copy"><SkeletonBlock className="page-skeleton__runs-card-title" /><SkeletonBlock className="page-skeleton__runs-card-date" /><div className="page-skeleton__runs-card-metrics"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></div></SkeletonPanel>)}
          </div>
        </SkeletonPanel>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'run-detail') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__run-detail-profile">
        <SkeletonBlock className="page-skeleton__run-detail-kicker" />
        <div className="page-skeleton__run-detail-profile-grid"><SkeletonBlock className="page-skeleton__run-detail-title" /><SkeletonBlock className="page-skeleton__run-detail-date" /><SkeletonBlock className="page-skeleton__run-detail-route" /></div>
        <SkeletonStats count={4} className="page-skeleton__run-detail-stats" />
      </SkeletonPanel>
      <div className="page-skeleton__run-detail-main-grid">
        <SkeletonPanel className="page-skeleton__run-detail-map-card"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__map page-skeleton__map--large" /><div className="page-skeleton__run-detail-map-meta"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__run-detail-stat-rail"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={6} /></SkeletonPanel>
      </div>
      <SkeletonPanel className="page-skeleton__run-detail-telemetry"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__chart page-skeleton__chart--tall" /><div className="page-skeleton__run-detail-metrics">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div></SkeletonPanel>
      <div className="page-skeleton__run-detail-bottom-grid"><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={5} /></SkeletonPanel><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={5} /></SkeletonPanel></div>
    </RunnerFrame>;
  }

  if (variant === 'analysis') {
    return <RunnerFrame variant={variant}>
      <div className="page-skeleton__analysis-cockpit">
        <SkeletonPanel className="page-skeleton__analysis-primary">
          <div className="page-skeleton__analysis-card-head">
            <div>
              <SkeletonBlock className="page-skeleton__analysis-kicker" />
              <SkeletonBlock className="page-skeleton__analysis-title" />
            </div>
            <SkeletonBlock className="page-skeleton__analysis-value" />
          </div>
          <div className="page-skeleton__analysis-bars">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="page-skeleton__analysis-bar-column">
                <SkeletonBlock className="page-skeleton__analysis-bar" />
                <SkeletonBlock className="page-skeleton__analysis-bar-label" />
              </div>
            ))}
          </div>
          <div className="page-skeleton__analysis-decision-spine">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonPanel key={index} className="page-skeleton__analysis-decision-chip">
                <SkeletonBlock className="page-skeleton__analysis-decision-label" />
                <SkeletonBlock className="page-skeleton__analysis-decision-value" />
              </SkeletonPanel>
            ))}
          </div>
        </SkeletonPanel>

        <div className="page-skeleton__analysis-reference-grid">
          <SkeletonPanel className="page-skeleton__analysis-reference page-skeleton__analysis-reference--load">
            <SkeletonBlock className="page-skeleton__analysis-reference-kicker" />
            <SkeletonBlock className="page-skeleton__analysis-gauge" />
            <SkeletonBlock className="page-skeleton__analysis-reference-value" />
            <SkeletonBlock className="page-skeleton__analysis-reference-status" />
            <SkeletonBlock className="page-skeleton__analysis-reference-copy" />
          </SkeletonPanel>
          <SkeletonPanel className="page-skeleton__analysis-reference page-skeleton__analysis-reference--coach">
            <SkeletonBlock className="page-skeleton__analysis-reference-kicker" />
            <SkeletonLines count={2} className="page-skeleton__analysis-reference-lines" />
            <SkeletonBlock className="page-skeleton__analysis-coach-badge" />
          </SkeletonPanel>
          <SkeletonPanel className="page-skeleton__analysis-reference page-skeleton__analysis-reference--trend">
            <SkeletonBlock className="page-skeleton__analysis-reference-kicker" />
            <SkeletonBlock className="page-skeleton__analysis-trend-title" />
            <SkeletonBlock className="page-skeleton__analysis-trend-value" />
            <SkeletonBlock className="page-skeleton__analysis-reference-copy" />
          </SkeletonPanel>
        </div>
      </div>

      <div className="page-skeleton__analysis-bento-grid">
        <SkeletonPanel className="page-skeleton__analysis-bento-card page-skeleton__analysis-bento-card--intensity">
          <SkeletonBlock className="page-skeleton__analysis-bento-kicker" />
          <SkeletonBlock className="page-skeleton__analysis-bento-value" />
          <SkeletonBlock className="page-skeleton__analysis-intensity-bar" />
          <div className="page-skeleton__analysis-bento-labels"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
        </SkeletonPanel>
        <SkeletonPanel className="page-skeleton__analysis-bento-card page-skeleton__analysis-bento-card--injury">
          <SkeletonBlock className="page-skeleton__analysis-bento-kicker" />
          <SkeletonBlock className="page-skeleton__analysis-bento-title" />
          <SkeletonBlock className="page-skeleton__analysis-risk-value" />
          <SkeletonBlock className="page-skeleton__analysis-risk-meter" />
          <SkeletonLines count={2} />
        </SkeletonPanel>
        <SkeletonPanel className="page-skeleton__analysis-bento-card page-skeleton__analysis-bento-card--forecast">
          <SkeletonBlock className="page-skeleton__analysis-bento-kicker" />
          <SkeletonBlock className="page-skeleton__analysis-forecast-value" />
          <SkeletonBlock className="page-skeleton__analysis-forecast-note" />
        </SkeletonPanel>
      </div>

      <div className="page-skeleton__analysis-table-grid">
        {Array.from({ length: 2 }, (_, tableIndex) => (
          <SkeletonPanel key={tableIndex} className="page-skeleton__analysis-table-card">
            <SkeletonBlock className="page-skeleton__analysis-table-title" />
            <div className="page-skeleton__analysis-table-head"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
            <div className="page-skeleton__analysis-table-rows">
              {Array.from({ length: 4 }, (_, rowIndex) => (
                <div key={rowIndex} className="page-skeleton__analysis-table-row"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
              ))}
            </div>
          </SkeletonPanel>
        ))}
      </div>

      <SkeletonPanel className="page-skeleton__analysis-injury">
        <div className="page-skeleton__analysis-injury-heading"><SkeletonBlock className="page-skeleton__analysis-injury-title" /><SkeletonBlock className="page-skeleton__analysis-injury-copy" /></div>
        <div className="page-skeleton__analysis-injury-grid">
          {Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__analysis-injury-card"><SkeletonBlock className="page-skeleton__analysis-bento-kicker" /><SkeletonBlock className="page-skeleton__analysis-bento-title" /><SkeletonBlock className="page-skeleton__analysis-injury-art" /><SkeletonLines count={2} /></SkeletonPanel>)}
        </div>
      </SkeletonPanel>
    </RunnerFrame>;
  }

  if (variant === 'weather') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__weather-hero">
        <div className="page-skeleton__weather-copy"><SkeletonBlock className="page-skeleton__weather-kicker" /><SkeletonBlock className="page-skeleton__weather-title" /><SkeletonLines count={2} /><div className="page-skeleton__weather-chips">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></div>
        <div className="page-skeleton__weather-metrics">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__weather-metric"><SkeletonBlock className="page-skeleton__weather-icon" /><SkeletonBlock className="page-skeleton__weather-metric-label" /><SkeletonBlock className="page-skeleton__weather-temp" /></SkeletonPanel>)}</div>
      </SkeletonPanel>
      <SkeletonPanel className="page-skeleton__weather-forecast"><SkeletonBlock className="page-skeleton__weather-section-kicker" /><SkeletonBlock className="page-skeleton__weather-section-title" /><SkeletonLines count={2} /><div className="page-skeleton__forecast-row">{Array.from({ length: 5 }, (_, index) => <SkeletonBlock key={index} />)}</div></SkeletonPanel>
      <div className="page-skeleton__weather-lower-grid"><SkeletonPanel className="page-skeleton__weather-engine"><SkeletonBlock className="page-skeleton__weather-section-kicker" /><SkeletonBlock className="page-skeleton__weather-section-title" /><SkeletonLines count={3} /><div className="page-skeleton__weather-engine-meter"><SkeletonBlock /><SkeletonBlock /></div><div className="page-skeleton__weather-engine-stats">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></SkeletonPanel><SkeletonPanel className="page-skeleton__weather-coach"><SkeletonBlock className="page-skeleton__weather-section-kicker" /><SkeletonBlock className="page-skeleton__weather-section-title" /><SkeletonLines count={4} /><SkeletonRows count={3} /><div className="page-skeleton__weather-coach-actions"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel></div>
    </RunnerFrame>;
  }

  if (variant === 'analysis-insight') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__insight-command"><div><SkeletonBlock className="page-skeleton__insight-kicker" /><SkeletonBlock className="page-skeleton__insight-title" /><SkeletonLines count={2} /><div className="page-skeleton__insight-actions"><SkeletonBlock /><SkeletonBlock /></div></div><SkeletonBlock className="page-skeleton__insight-gauge" /></SkeletonPanel>
      <div className="page-skeleton__insight-command-grid"><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__chart page-skeleton__chart--tall" /><div className="page-skeleton__insight-trend-stats">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></SkeletonPanel><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={5} /></SkeletonPanel></div>
      <div className="page-skeleton__insight-evidence-grid">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={3} /><SkeletonBlock className="page-skeleton__insight-evidence-art" /></SkeletonPanel>)}</div>
    </RunnerFrame>;
  }

  if (variant === 'shoes') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__shoes-signal">
        <div className="page-skeleton__shoes-signal-head">
          <div className="page-skeleton__shoes-signal-copy">
            <SkeletonBlock className="page-skeleton__shoes-kicker" />
            <SkeletonBlock className="page-skeleton__shoes-signal-title" />
            <SkeletonLines count={2} />
          </div>
          <div className="page-skeleton__shoes-signal-pills">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div>
        </div>
        <div className="page-skeleton__shoes-signal-body">
          <SkeletonPanel className="page-skeleton__shoes-signal-highlight">
            <SkeletonBlock className="page-skeleton__shoes-highlight-kicker" />
            <SkeletonBlock className="page-skeleton__shoes-highlight-title" />
            <SkeletonLines count={2} />
          </SkeletonPanel>
          <div className="page-skeleton__shoes-signal-sidecar">
            <SkeletonPanel className="page-skeleton__shoes-signal-glass">
              <SkeletonBlock className="page-skeleton__shoes-card-kicker" />
              <SkeletonBlock className="page-skeleton__shoes-side-title" />
              <SkeletonLines count={2} />
              <SkeletonBlock className="page-skeleton__shoes-side-metric" />
            </SkeletonPanel>
            <div className="page-skeleton__shoes-signal-meta">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>)}</div>
            <SkeletonLines count={3} />
            <SkeletonBlock className="page-skeleton__shoes-signal-source" />
          </div>
        </div>
      </SkeletonPanel>

      <SkeletonPanel className="page-skeleton__shoes-stage">
        <div className="page-skeleton__shoes-topbar">
          <div className="page-skeleton__shoes-topbar-title"><SkeletonBlock className="page-skeleton__shoes-topbar-toggle" /><SkeletonBlock className="page-skeleton__shoes-topbar-label" /></div>
          <div className="page-skeleton__shoes-topbar-actions"><SkeletonBlock className="page-skeleton__shoes-search" /><SkeletonBlock className="page-skeleton__shoes-add" /></div>
        </div>
        <div className="page-skeleton__shoes-hero">
          <SkeletonBlock className="page-skeleton__shoes-title" />
          <div className="page-skeleton__shoes-tabs">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div>
        </div>
        <div className="page-skeleton__shoes-health-summary">{Array.from({ length: 2 }, (_, index) => <SkeletonBlock key={index} />)}</div>
        <SkeletonPanel className="page-skeleton__shoes-manage">
          <div className="page-skeleton__shoes-manage-head"><SkeletonBlock className="page-skeleton__shoes-card-kicker" /><div><SkeletonBlock /><SkeletonBlock /></div></div>
          <div className="page-skeleton__shoes-manage-grid">{Array.from({ length: 3 }, (_, index) => <div key={index}><SkeletonBlock className="page-skeleton__shoes-card-kicker" /><div>{Array.from({ length: index === 1 ? 4 : 3 }, (_, pillIndex) => <SkeletonBlock key={pillIndex} />)}</div></div>)}</div>
        </SkeletonPanel>
        <SkeletonBlock className="page-skeleton__shoes-status" />
        <div className="page-skeleton__shoes-inventory-grid">
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonPanel key={index} className="page-skeleton__shoes-inventory-card">
              <SkeletonBlock className="page-skeleton__shoes-inventory-art" />
              <div className="page-skeleton__shoes-inventory-copy"><SkeletonBlock className="page-skeleton__shoes-inventory-title" /><SkeletonLines count={2} /></div>
              <div className="page-skeleton__shoes-inventory-meta"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
            </SkeletonPanel>
          ))}
        </div>
      </SkeletonPanel>
    </RunnerFrame>;
  }

  if (variant === 'shoe-catalog') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__catalog-command"><div>{commonHeader}<div className="page-skeleton__catalog-summary">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></div><SkeletonBlock className="page-skeleton__hero-art page-skeleton__hero-art--shoe" /></SkeletonPanel>
      <div className="page-skeleton__toolbar"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock className="page-skeleton__toolbar-action" /></div>
      <div className="page-skeleton__product-grid">{Array.from({ length: 6 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__product-card"><SkeletonBlock className="page-skeleton__product-image" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__copy page-skeleton__copy--short" /></SkeletonPanel>)}</div>
    </RunnerFrame>;
  }

  if (variant === 'races') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__races-hero">{commonHeader}<SkeletonBlock className="page-skeleton__hero-art page-skeleton__hero-art--map" /></SkeletonPanel>
      <div className="page-skeleton__calendar-strip">{Array.from({ length: 6 }, (_, index) => <SkeletonBlock key={index} />)}</div>
      <div className="page-skeleton__race-grid">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__race-date" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={2} /></SkeletonPanel>)}</div>
    </RunnerFrame>;
  }

  if (variant === 'race-detail') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__race-detail-command"><SkeletonBlock className="page-skeleton__detail-image" /><div>{commonHeader}<div className="page-skeleton__countdown">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div></div></SkeletonPanel>
      <div className="page-skeleton__race-detail-metrics">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>)}</div>
      <SkeletonPanel className="page-skeleton__race-detail-profile"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={2} /><SkeletonBlock className="page-skeleton__chart page-skeleton__chart--tall" /></SkeletonPanel>
      <SkeletonPanel className="page-skeleton__map-panel"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__map page-skeleton__map--large" /><SkeletonLines count={2} /></SkeletonPanel>
    </RunnerFrame>;
  }

  if (variant === 'schedule') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__schedule-command">
        <div className="page-skeleton__schedule-command-copy"><SkeletonBlock className="page-skeleton__schedule-kicker" /><SkeletonBlock className="page-skeleton__schedule-title" /></div>
        <div className="page-skeleton__schedule-command-metrics">
          {Array.from({ length: 2 }, (_, index) => <div key={index} className="page-skeleton__schedule-command-metric"><SkeletonBlock className="page-skeleton__schedule-command-metric-label" /><SkeletonBlock className="page-skeleton__schedule-command-metric-value" /></div>)}
        </div>
        <SkeletonBlock className="page-skeleton__schedule-command-pulse" />
      </SkeletonPanel>
      <div className="page-skeleton__schedule-week-grid">{Array.from({ length: 7 }, (_, index) => <SkeletonPanel key={index} className={`page-skeleton__schedule-day${index === 2 ? ' page-skeleton__schedule-day--active' : ''}`}><SkeletonBlock /><SkeletonBlock /><SkeletonLines count={2} /><SkeletonBlock /></SkeletonPanel>)}</div>
      <div className="page-skeleton__schedule-bottom-grid">
        <div className="page-skeleton__schedule-left-rail">
          <div className="page-skeleton__schedule-dual-grid"><SkeletonPanel className="page-skeleton__schedule-readiness"><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonBlock className="page-skeleton__schedule-readiness-ring" /><SkeletonBlock className="page-skeleton__schedule-score" /><SkeletonLines count={2} /></SkeletonPanel><SkeletonPanel className="page-skeleton__schedule-next"><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonBlock className="page-skeleton__schedule-next-title" /><SkeletonLines count={3} /><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel></div>
          <SkeletonPanel className="page-skeleton__schedule-route"><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonBlock className="page-skeleton__schedule-route-map" /><div className="page-skeleton__schedule-route-meta"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel>
        </div>
        <div className="page-skeleton__schedule-right-rail"><SkeletonPanel className="page-skeleton__schedule-coach-card"><div className="page-skeleton__schedule-coach-head"><div><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonBlock className="page-skeleton__schedule-coach-title" /></div><SkeletonBlock className="page-skeleton__schedule-coach-avatar" /></div><SkeletonBlock className="page-skeleton__schedule-coach-summary" /><SkeletonLines count={3} /><div className="page-skeleton__schedule-coach-focus">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div><div className="page-skeleton__schedule-coach-signals">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel><SkeletonPanel><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonBlock className="page-skeleton__schedule-coach" /><SkeletonRows count={3} /></SkeletonPanel><SkeletonPanel><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonLines count={3} /><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel></div>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'today-run') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__today-coaching"><div className="page-skeleton__today-coaching-head"><SkeletonBlock className="page-skeleton__today-kicker" /><SkeletonBlock className="page-skeleton__today-coaching-title" /></div><div className="page-skeleton__today-coaching-grid">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>)}</div></SkeletonPanel>
      <SkeletonPanel className="page-skeleton__today-command"><div><SkeletonBlock className="page-skeleton__today-kicker" /><SkeletonBlock className="page-skeleton__today-title" /><SkeletonLines count={2} /></div><div className="page-skeleton__today-command-side"><SkeletonBlock className="page-skeleton__today-readiness" /><SkeletonBlock className="page-skeleton__today-action" /></div><SkeletonStats count={4} className="page-skeleton__today-stats" /></SkeletonPanel>
      <div className="page-skeleton__today-middle-grid"><SkeletonPanel className="page-skeleton__today-shoe"><SkeletonBlock className="page-skeleton__today-card-kicker" /><SkeletonBlock className="page-skeleton__today-shoe-art" /><SkeletonBlock className="page-skeleton__today-shoe-title" /><SkeletonLines count={2} /></SkeletonPanel><SkeletonPanel className="page-skeleton__today-blueprint"><SkeletonBlock className="page-skeleton__today-card-kicker" /><SkeletonBlock className="page-skeleton__panel-title" /><div className="page-skeleton__today-blueprint-steps">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock /><SkeletonBlock /><SkeletonLines count={2} /></SkeletonPanel>)}</div></SkeletonPanel></div>
      <SkeletonPanel className="page-skeleton__today-coach"><div className="page-skeleton__today-coach-head"><SkeletonBlock className="page-skeleton__today-card-kicker" /><SkeletonBlock className="page-skeleton__today-coach-avatar" /></div><SkeletonBlock className="page-skeleton__today-coach-title" /><SkeletonLines count={3} /><div className="page-skeleton__today-coach-reasons">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div><div className="page-skeleton__today-coach-metrics">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div><div className="page-skeleton__today-coach-actions">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></SkeletonPanel>
    </RunnerFrame>;
  }

  if (variant === 'prediction') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__prediction-command"><div>{commonHeader}<SkeletonLines count={2} /><div className="page-skeleton__prediction-actions"><SkeletonBlock /><SkeletonBlock /></div></div><SkeletonBlock className="page-skeleton__prediction-time" /></SkeletonPanel>
      <div className="page-skeleton__prediction-command-grid"><SkeletonPanel className="page-skeleton__prediction-forecast"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__prediction-main-value" /><SkeletonBlock className="page-skeleton__chart page-skeleton__chart--tall" /></SkeletonPanel><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={5} /></SkeletonPanel></div>
      <div className="page-skeleton__prediction-evidence-grid">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={3} /><SkeletonBlock className="page-skeleton__prediction-evidence-art" /></SkeletonPanel>)}</div>
    </RunnerFrame>;
  }

  if (variant === 'muscle-training') {
    return <RunnerFrame variant={variant}>
      <div className="page-skeleton__muscle-above-fold">
        <SkeletonPanel className="page-skeleton__muscle-selector">
          <SkeletonBlock className="page-skeleton__muscle-section-title" />
          <div className="page-skeleton__muscle-view-toggle"><SkeletonBlock /><SkeletonBlock /></div>
          <SkeletonBlock className="page-skeleton__muscle-body-plate" />
          <div className="page-skeleton__muscle-recommendation-callout"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
          <div className="page-skeleton__muscle-toggles">{Array.from({ length: 6 }, (_, index) => <SkeletonBlock key={index} />)}</div>
        </SkeletonPanel>
        <SkeletonPanel className="page-skeleton__muscle-recommendations">
          <SkeletonBlock className="page-skeleton__muscle-section-title" />
          <SkeletonRows count={4} />
          <SkeletonBlock className="page-skeleton__muscle-footnote" />
        </SkeletonPanel>
        <SkeletonPanel className="page-skeleton__muscle-reference">
          <SkeletonBlock className="page-skeleton__muscle-card-kicker" />
          <SkeletonBlock className="page-skeleton__panel-title" />
          <SkeletonBlock className="page-skeleton__muscle-reference-image" />
          <SkeletonBlock className="page-skeleton__muscle-reference-title" />
          <SkeletonLines count={2} />
          <div className="page-skeleton__muscle-reference-cues">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div>
          <div className="page-skeleton__muscle-target-pills">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div>
        </SkeletonPanel>
      </div>
      <div className="page-skeleton__muscle-workbench-grid">
        <SkeletonPanel><SkeletonBlock className="page-skeleton__muscle-card-kicker" /><SkeletonBlock className="page-skeleton__panel-title" /><div className="page-skeleton__muscle-filter-row">{Array.from({ length: 5 }, (_, index) => <SkeletonBlock key={index} />)}</div><SkeletonRows count={6} /></SkeletonPanel>
        <SkeletonPanel><SkeletonBlock className="page-skeleton__muscle-card-kicker" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__muscle-reference-image" /><SkeletonLines count={4} /></SkeletonPanel>
      </div>
      <div className="page-skeleton__muscle-bottom-grid"><SkeletonPanel className="page-skeleton__muscle-checkin"><SkeletonBlock className="page-skeleton__muscle-card-kicker" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={5} /><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel><SkeletonPanel className="page-skeleton__muscle-tuning"><SkeletonBlock className="page-skeleton__muscle-card-kicker" /><SkeletonLines count={3} /><div className="page-skeleton__muscle-form-grid">{Array.from({ length: 6 }, (_, index) => <SkeletonBlock key={index} />)}</div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel></div>
    </RunnerFrame>;
  }

  if (variant === 'rewards') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__rewards-command"><div><SkeletonBlock className="page-skeleton__rewards-kicker" /><SkeletonBlock className="page-skeleton__rewards-title" /><SkeletonLines count={2} /></div><div className="page-skeleton__rewards-command-side"><SkeletonBlock className="page-skeleton__rewards-ring" /><SkeletonBlock className="page-skeleton__rewards-command-value" /><SkeletonLines count={2} /></div></SkeletonPanel>
      <SkeletonPanel className="page-skeleton__rewards-achievements"><div className="page-skeleton__rewards-achievements-head"><SkeletonBlock className="page-skeleton__rewards-card-kicker" /><SkeletonBlock className="page-skeleton__rewards-achievements-title" /></div><div className="page-skeleton__rewards-achievements-body"><SkeletonBlock className="page-skeleton__rewards-progress-ring" /><div><SkeletonBlock className="page-skeleton__rewards-achievements-value" /><SkeletonLines count={2} /><SkeletonBlock className="page-skeleton__rewards-meter" /></div><SkeletonPanel className="page-skeleton__rewards-next"><SkeletonBlock /><SkeletonBlock /><SkeletonLines count={2} /><SkeletonBlock /></SkeletonPanel></div></SkeletonPanel>
      <SkeletonStats count={4} className="page-skeleton__rewards-stats" />
      <div className="page-skeleton__rewards-catalog-grid"><SkeletonPanel className="page-skeleton__rewards-badge-catalog"><SkeletonBlock className="page-skeleton__rewards-card-kicker" /><SkeletonBlock className="page-skeleton__rewards-catalog-title" /><div className="page-skeleton__rewards-badge-grid">{Array.from({ length: 12 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>)}</div></SkeletonPanel><SkeletonPanel className="page-skeleton__rewards-targets"><SkeletonBlock className="page-skeleton__rewards-card-kicker" /><SkeletonBlock className="page-skeleton__rewards-catalog-title" /><SkeletonRows count={3} /></SkeletonPanel></div>
    </RunnerFrame>;
  }

  if (variant === 'settings') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__settings-identity-hero">
        <div className="page-skeleton__settings-identity-copy">
          <div className="page-skeleton__settings-avatar-wrap"><SkeletonBlock className="page-skeleton__settings-avatar" /><SkeletonBlock className="page-skeleton__settings-avatar-badge" /></div>
          <div><SkeletonBlock className="page-skeleton__settings-identity-title" /><SkeletonLines count={2} /><div className="page-skeleton__settings-identity-chips">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></div>
        </div>
        <div className="page-skeleton__settings-completion"><SkeletonBlock className="page-skeleton__settings-completion-label" /><SkeletonBlock className="page-skeleton__settings-completion-value" /><SkeletonBlock className="page-skeleton__settings-completion-track" /></div>
      </SkeletonPanel>
      <div className="page-skeleton__settings-content-grid">
        <SkeletonPanel className="page-skeleton__settings-profile"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><div className="page-skeleton__settings-field-group"><SkeletonBlock /><SkeletonBlock className="page-skeleton__settings-field" /></div><div className="page-skeleton__settings-field-group"><SkeletonBlock /><SkeletonBlock className="page-skeleton__settings-textarea" /></div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__settings-preferences"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><div className="page-skeleton__settings-preference-row"><div><SkeletonBlock /><SkeletonBlock /></div><div className="page-skeleton__settings-segmented">{Array.from({ length: 2 }, (_, index) => <SkeletonBlock key={index} />)}</div></div><div className="page-skeleton__settings-preference-row"><div><SkeletonBlock /><SkeletonBlock /></div><div className="page-skeleton__settings-theme-cards">{Array.from({ length: 2 }, (_, index) => <SkeletonBlock key={index} />)}</div></div><div className="page-skeleton__settings-preference-row"><div><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock className="page-skeleton__settings-select" /></div></SkeletonPanel>
      </div>
      <div className="page-skeleton__settings-bottom-grid">
        <SkeletonPanel className="page-skeleton__settings-checklist"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><SkeletonLines count={2} /><SkeletonRows count={4} /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__settings-weekly"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><SkeletonLines count={2} /><div className="page-skeleton__settings-weekly-toggle"><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel>
      </div>
      <div className="page-skeleton__settings-services-grid">
        <SkeletonPanel className="page-skeleton__settings-services"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><div className="page-skeleton__settings-service-cards">{Array.from({ length: 2 }, (_, index) => <div key={index} className="page-skeleton__settings-service-card"><SkeletonBlock /><div><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock /></div>)}</div><SkeletonBlock className="page-skeleton__settings-sync-title" /><SkeletonRows count={4} /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__settings-health"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><SkeletonLines count={2} /><SkeletonRows count={4} /></SkeletonPanel>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'garmin') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__garmin-command"><div>{commonHeader}<SkeletonLines count={2} /></div><SkeletonBlock className="page-skeleton__garmin-device" /></SkeletonPanel>
      <div className="page-skeleton__garmin-content-grid"><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={4} /><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={4} /><div className="page-skeleton__garmin-status-grid">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel></div>
    </RunnerFrame>;
  }

  if (variant === 'import-data') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__import-command"><div>{commonHeader}<SkeletonLines count={2} /></div><SkeletonBlock className="page-skeleton__import-command-art" /></SkeletonPanel>
      <SkeletonPanel className="page-skeleton__import-workbench"><SkeletonBlock className="page-skeleton__panel-title" /><div className="page-skeleton__import-sources">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__import-source"><SkeletonBlock className="page-skeleton__import-source-icon" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={2} /><SkeletonBlock className="page-skeleton__form-field" /></SkeletonPanel>)}</div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel>
    </RunnerFrame>;
  }

  if (variant === 'add-shoes') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__add-shoes-command"><div>{commonHeader}<SkeletonLines count={2} /><div className="page-skeleton__add-shoes-steps">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></div><SkeletonBlock className="page-skeleton__hero-art page-skeleton__hero-art--shoe" /></SkeletonPanel>
      <div className="page-skeleton__add-shoes-content-grid"><SkeletonPanel className="page-skeleton__settings-form"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__form-field" /><SkeletonBlock className="page-skeleton__form-field" /><SkeletonBlock className="page-skeleton__form-field" /><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel><SkeletonPanel><SkeletonBlock className="page-skeleton__product-image" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={3} /><SkeletonRows count={3} /></SkeletonPanel></div>
    </RunnerFrame>;
  }

  return <RunnerFrame variant="runner">
    <SkeletonPanel className="page-skeleton__command-hero">{commonHeader}<SkeletonBlock className="page-skeleton__hero-art" /></SkeletonPanel>
    <SkeletonStats count={3} />
    <SkeletonPanel><SkeletonBlock className="page-skeleton__chart" /></SkeletonPanel>
  </RunnerFrame>;
}

function LandingPageSkeleton() {
  return (
    <div className="page-skeleton page-skeleton--landing" role="status" aria-live="polite" aria-busy="true" aria-label="Loading page">
      <header className="page-skeleton__landing-header" aria-hidden="true">
        <div className="page-skeleton__landing-brand-wrap"><SkeletonBlock className="page-skeleton__landing-brand-glyph" /><SkeletonBlock className="page-skeleton__landing-brand" /></div>
        <nav className="page-skeleton__landing-nav"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></nav>
        <div className="page-skeleton__landing-actions"><SkeletonBlock /><SkeletonBlock /></div>
      </header>
      <main className="page-skeleton__landing-main" aria-hidden="true">
        <section className="page-skeleton__landing-hero">
          <div className="page-skeleton__landing-copy-column">
            <div className="page-skeleton__landing-title-stack"><SkeletonBlock className="page-skeleton__landing-title" /><SkeletonBlock className="page-skeleton__landing-title page-skeleton__landing-title--second" /><SkeletonBlock className="page-skeleton__landing-title page-skeleton__landing-title--accent" /></div>
            <SkeletonLines count={2} className="page-skeleton__landing-copy" />
            <div className="page-skeleton__landing-hero-actions"><SkeletonBlock /><SkeletonBlock /></div>
            <SkeletonBlock className="page-skeleton__landing-trust" />
          </div>
          <div className="page-skeleton__landing-art"><SkeletonBlock className="page-skeleton__landing-shoe" style={{ '--page-skeleton-shoe-mask': `url(${shoeSkeletonAsset})` }} /><SkeletonBlock className="page-skeleton__landing-shadow" /></div>
        </section>
        <section className="page-skeleton__landing-feature-preview"><SkeletonBlock /><div><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></section>
      </main>
    </div>
  );
}

function AuthPageSkeleton({ variant = 'auth' }) {
  const isSignup = variant === 'signup';
  const isForgotPassword = variant === 'forgot-password';
  const isAdmin = variant === 'admin-login';
  const fieldCount = isForgotPassword ? 1 : isSignup ? 4 : 2;
  return (
    <div className={`page-skeleton page-skeleton--${variant}`} role="status" aria-live="polite" aria-busy="true" aria-label="Loading page">
      <div className="page-skeleton__auth-dot-field" aria-hidden="true" />
      <section className="page-skeleton__auth-brand" aria-hidden="true">
        <div className="page-skeleton__auth-brand-head">
          <SkeletonBlock className="page-skeleton__auth-wordmark" />
          <SkeletonBlock className="page-skeleton__auth-pulse" />
        </div>
        <div className="page-skeleton__auth-carousel">
          <SkeletonBlock className="page-skeleton__auth-kicker" />
          <SkeletonBlock className="page-skeleton__auth-title" />
          <SkeletonBlock className="page-skeleton__auth-title page-skeleton__auth-title--short" />
          <SkeletonLines count={3} className="page-skeleton__auth-copy" />
          <div className="page-skeleton__auth-slide-details">
            {Array.from({ length: 3 }, (_, index) => <div key={index}><SkeletonBlock /><SkeletonBlock /></div>)}
          </div>
          <div className="page-skeleton__auth-stats">
            <div><SkeletonBlock /><SkeletonBlock /></div>
            <div><SkeletonBlock /><SkeletonBlock /></div>
          </div>
          <div className="page-skeleton__auth-brand-actions"><SkeletonBlock /><SkeletonBlock /></div>
          <div className="page-skeleton__auth-dots"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
        </div>
      </section>
      <section className="page-skeleton__auth-formside" aria-hidden="true">
        <div className="page-skeleton__auth-card">
          <div className="page-skeleton__auth-header"><SkeletonBlock className="page-skeleton__auth-card-title" /><SkeletonBlock className="page-skeleton__auth-card-copy" /></div>
          {!isAdmin && <SkeletonBlock className="page-skeleton__auth-divider" />}
          <div className="page-skeleton__auth-form">
            {Array.from({ length: fieldCount }, (_, index) => (
              <div key={index} className="page-skeleton__auth-field-group">
                <div className="page-skeleton__auth-label-row"><SkeletonBlock className="page-skeleton__auth-label" />{!isSignup && !isForgotPassword && index === 1 && <SkeletonBlock className="page-skeleton__auth-forgot" />}</div>
                <SkeletonBlock className="page-skeleton__auth-field" />
              </div>
            ))}
            {isSignup && <SkeletonBlock className="page-skeleton__auth-strength" />}
            <SkeletonBlock className="page-skeleton__auth-button" />
          </div>
          {!isAdmin && (
            <>
              <div className="page-skeleton__auth-social">
                <SkeletonBlock /><SkeletonBlock />
                <SkeletonLines count={2} /><SkeletonLines count={2} />
              </div>
              <div className="page-skeleton__auth-signup"><SkeletonBlock /><SkeletonBlock /></div>
            </>
          )}
        </div>
        {!isAdmin && <footer className="page-skeleton__auth-legal"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></footer>}
      </section>
    </div>
  );
}

function LegalPageSkeleton() {
  return (
    <div className="page-skeleton page-skeleton--legal" role="status" aria-live="polite" aria-busy="true" aria-label="Loading page"><SkeletonBlock className="page-skeleton__legal-kicker" /><SkeletonBlock className="page-skeleton__legal-title" /><SkeletonLines count={2} className="page-skeleton__legal-intro" /><div className="page-skeleton__legal-sections" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <article key={index}><SkeletonBlock className="page-skeleton__legal-heading" /><SkeletonLines count={3} /></article>)}</div></div>
  );
}

export default function PageSkeleton({ variant = 'runner' }) {
  if (variant === 'landing') return <LandingPageSkeleton />;
  if (['auth', 'login', 'signup', 'forgot-password', 'admin-login'].includes(variant)) return <AuthPageSkeleton variant={variant === 'login' ? 'auth' : variant} />;
  if (variant === 'legal') return <LegalPageSkeleton />;
  return <RunnerPageSkeleton variant={variant} />;
}
