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

function RunnerFooterSkeleton() {
  return (
    <footer className="page-skeleton__runner-footer" aria-hidden="true">
      <div className="page-skeleton__runner-footer-links">
        {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}
      </div>
    </footer>
  );
}

function RunnerFrame({ variant, children }) {
  const rootClassName = ['page-skeleton', 'page-skeleton--runner', 'is-sidebar-collapsed', `page-skeleton--${variant}`].join(' ');
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
        <section className="page-skeleton__canvas">
          {children}
          <RunnerFooterSkeleton />
        </section>
      </main>
    </div>
  );
}

const ADMIN_SKELETON_TABS = ['overview', 'users', 'courseMaps', 'shoes', 'jobs', 'audit', 'settings'];

function AdminRouteSkeletonShell({ activeTab, children }) {
  return (
    <div className={`page-skeleton__admin-route admin-command-route admin-command-route__surface ops-page admin-command-route--${activeTab}`}>
      {children}
    </div>
  );
}

function AdminRouteSkeletonHeading({ className = '' }) {
  return (
    <div className={`page-skeleton__admin-route-heading ${className}`.trim()}>
      <SkeletonBlock className="page-skeleton__admin-eyebrow" />
      <SkeletonBlock className="page-skeleton__admin-route-title" />
      <SkeletonLines count={2} />
    </div>
  );
}

function AdminOverviewSkeleton() {
  return (
    <AdminRouteSkeletonShell activeTab="overview">
      <div className="page-skeleton__admin-overview ops-page">
        <div className="page-skeleton__admin-ops-metrics">
          {Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-ops-value" /><SkeletonBlock className="page-skeleton__admin-ops-label" /></SkeletonPanel>)}
        </div>
        <div className="page-skeleton__admin-ops-queues">
          {Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-ops-dot" /><SkeletonBlock className="page-skeleton__admin-ops-value" /><SkeletonBlock className="page-skeleton__admin-ops-label" /></SkeletonPanel>)}
        </div>
        <div className="page-skeleton__admin-overview-charts">
          {Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__admin-overview-chart"><AdminRouteSkeletonHeading /><SkeletonBlock className="page-skeleton__admin-chart-canvas" /></SkeletonPanel>)}
        </div>
        <div className="page-skeleton__admin-overview-two-col">
          {Array.from({ length: 2 }, (_, index) => <SkeletonPanel key={index}><AdminRouteSkeletonHeading /><SkeletonRows count={index === 0 ? 4 : 3} /></SkeletonPanel>)}
        </div>
        <div className="page-skeleton__admin-overview-actions">
          {Array.from({ length: 6 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-action-icon" /><SkeletonBlock className="page-skeleton__admin-action-title" /><SkeletonBlock className="page-skeleton__admin-action-copy" /></SkeletonPanel>)}
        </div>
      </div>
    </AdminRouteSkeletonShell>
  );
}

function AdminUsersSkeleton() {
  return (
    <AdminRouteSkeletonShell activeTab="users">
      <section className="page-skeleton__admin-users admin-users-command-center">
        <section className="page-skeleton__admin-users-hero admin-users-command-hero"><AdminRouteSkeletonHeading /><div className="page-skeleton__admin-users-story"><SkeletonPanel className="page-skeleton__admin-users-story-primary"><SkeletonBlock className="page-skeleton__admin-ops-label" /><SkeletonBlock className="page-skeleton__admin-ops-value" /><SkeletonLines count={2} /></SkeletonPanel><div className="page-skeleton__admin-users-story-grid">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-ops-label" /><SkeletonBlock className="page-skeleton__admin-ops-value" /><SkeletonBlock className="page-skeleton__admin-action-copy" /></SkeletonPanel>)}</div></div></section>
        <section className="page-skeleton__admin-users-kpis admin-users-command-kpis">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-ops-label" /><SkeletonBlock className="page-skeleton__admin-ops-value" /><SkeletonBlock className="page-skeleton__admin-action-copy" /></SkeletonPanel>)}</section>
        <section className="page-skeleton__admin-users-console admin-users-command-console"><AdminRouteSkeletonHeading /><div className="page-skeleton__admin-filter-row"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div><div className="page-skeleton__admin-bulk-row"><SkeletonLines count={2} /><div><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></div><SkeletonPanel className="page-skeleton__admin-roster"><AdminRouteSkeletonHeading /><SkeletonRows count={7} /></SkeletonPanel></section>
      </section>
    </AdminRouteSkeletonShell>
  );
}

function AdminCourseMapsSkeleton() {
  return (
    <AdminRouteSkeletonShell activeTab="courseMaps">
      <section className="page-skeleton__admin-coursemaps admin-coursemap-rework">
        <section className="page-skeleton__admin-coursemaps-hero admin-coursemap-rework__hero"><AdminRouteSkeletonHeading /><div className="page-skeleton__admin-hero-meta"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></section>
        <div className="page-skeleton__admin-coursemaps-grid admin-coursemap-rework__grid"><SkeletonPanel className="page-skeleton__admin-coursemaps-rail"><AdminRouteSkeletonHeading /><div className="page-skeleton__admin-filter-row"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div><SkeletonRows count={8} /></SkeletonPanel><section className="page-skeleton__admin-coursemaps-stage admin-coursemap-rework__stage"><div className="page-skeleton__admin-coursemap-stack"><SkeletonPanel className="page-skeleton__admin-coursemap-head"><AdminRouteSkeletonHeading /><div className="page-skeleton__admin-stage-actions"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel><SkeletonPanel className="page-skeleton__admin-coursemap-compare"><div className="page-skeleton__admin-compare-grid">{Array.from({ length: 2 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-ops-label" /><SkeletonBlock className="page-skeleton__admin-map-frame" /><div className="page-skeleton__admin-telemetry"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel>)}</div><div className="page-skeleton__admin-telemetry"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel><SkeletonPanel className="page-skeleton__admin-coursemap-signals"><AdminRouteSkeletonHeading /><SkeletonLines count={3} /></SkeletonPanel><SkeletonPanel className="page-skeleton__admin-coursemap-decision"><AdminRouteSkeletonHeading /><SkeletonLines count={5} /></SkeletonPanel><SkeletonPanel className="page-skeleton__admin-coursemap-actions"><AdminRouteSkeletonHeading /><div className="page-skeleton__admin-stage-actions"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel><SkeletonPanel className="page-skeleton__admin-coursemap-footer"><SkeletonLines count={2} /></SkeletonPanel></div></section></div>
      </section>
    </AdminRouteSkeletonShell>
  );
}

function AdminShoesSkeleton() {
  return (
    <AdminRouteSkeletonShell activeTab="shoes">
      <section className="page-skeleton__admin-shoes admin-shoe-rework">
        <SkeletonPanel className="page-skeleton__admin-shoes-catalog admin-shoe-rework__card--catalog"><div className="page-skeleton__admin-catalog-header"><AdminRouteSkeletonHeading /><SkeletonBlock className="page-skeleton__admin-hero-badge" /></div><div className="page-skeleton__admin-catalog-actions"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div><section className="page-skeleton__admin-catalog-browser"><div className="page-skeleton__admin-catalog-browser-head"><AdminRouteSkeletonHeading /><SkeletonBlock className="page-skeleton__admin-hero-badge" /></div><div className="page-skeleton__admin-brand-rail">{Array.from({ length: 40 }, (_, index) => <SkeletonBlock key={index} />)}</div><div className="page-skeleton__admin-catalog-series"><div className="page-skeleton__admin-catalog-series-head"><AdminRouteSkeletonHeading /><SkeletonBlock className="page-skeleton__admin-hero-badge" /></div><div className="page-skeleton__admin-series-grid">{Array.from({ length: 27 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-brand-logo" /><SkeletonBlock className="page-skeleton__admin-action-title" /><SkeletonBlock className="page-skeleton__admin-action-copy" /></SkeletonPanel>)}</div></div></section><section className="page-skeleton__admin-catalog-published"><div className="page-skeleton__admin-catalog-published-head"><AdminRouteSkeletonHeading /><SkeletonBlock className="page-skeleton__admin-hero-badge" /></div><SkeletonBlock className="page-skeleton__admin-catalog-published-empty" /></section></SkeletonPanel>
      </section>
    </AdminRouteSkeletonShell>
  );
}

function AdminAuditSkeleton() {
  return (
    <AdminRouteSkeletonShell activeTab="audit">
      <section className="page-skeleton__admin-audit admin-audit-terminal"><section className="page-skeleton__admin-audit-hero admin-audit-terminal__hero"><AdminRouteSkeletonHeading /><SkeletonBlock className="page-skeleton__admin-audit-badge" /></section><div className="page-skeleton__admin-audit-metrics">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-ops-label" /><SkeletonBlock className="page-skeleton__admin-ops-value" /><SkeletonBlock className="page-skeleton__admin-action-copy" /></SkeletonPanel>)}</div><SkeletonPanel className="page-skeleton__admin-audit-table"><div className="page-skeleton__admin-table-toolbar"><AdminRouteSkeletonHeading /><div className="page-skeleton__admin-stage-actions"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></div><SkeletonRows count={20} className="page-skeleton__admin-audit-rows" /><div className="page-skeleton__admin-table-footer"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel><div className="page-skeleton__admin-audit-ctas">{Array.from({ length: 2 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-action-icon" /><SkeletonLines count={2} /><SkeletonBlock /></SkeletonPanel>)}</div></section>
    </AdminRouteSkeletonShell>
  );
}

function AdminSettingsSkeleton() {
  return (
    <AdminRouteSkeletonShell activeTab="settings">
      <section className="page-skeleton__admin-settings admin-settings-studio"><section className="page-skeleton__admin-settings-hero admin-settings-studio__hero"><AdminRouteSkeletonHeading /><div className="page-skeleton__admin-settings-stats">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__admin-ops-label" /><SkeletonBlock className="page-skeleton__admin-action-title" /></SkeletonPanel>)}</div></section><div className="page-skeleton__admin-settings-grid admin-settings-studio__grid">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><AdminRouteSkeletonHeading /><div className="page-skeleton__admin-settings-choices">{Array.from({ length: index === 2 ? 2 : 3 }, (_, choice) => <SkeletonBlock key={choice} />)}</div></SkeletonPanel>)}</div></section>
    </AdminRouteSkeletonShell>
  );
}

function AdminRouteSkeleton({ activeTab }) {
  if (activeTab === 'overview') return <AdminOverviewSkeleton />;
  if (activeTab === 'users') return <AdminUsersSkeleton />;
  if (activeTab === 'courseMaps') return <AdminCourseMapsSkeleton />;
  if (activeTab === 'shoes') return <AdminShoesSkeleton />;
  if (activeTab === 'audit') return <AdminAuditSkeleton />;
  if (activeTab === 'settings') return <AdminSettingsSkeleton />;
  return null;
}

function AdminPageSkeleton({ activeTab = 'overview' }) {
  const activeNavIndex = Math.max(0, ADMIN_SKELETON_TABS.indexOf(activeTab));
  const isJobs = activeTab === 'jobs';

  return (
    <div className="page-skeleton page-skeleton--admin" role="status" aria-live="polite" aria-busy="true" aria-label="Loading page">
      <div className="page-skeleton__admin-layout" aria-hidden="true">
        <aside className="page-skeleton__admin-sidebar">
          <div className="page-skeleton__admin-brand">
            <SkeletonBlock className="page-skeleton__admin-wordmark" />
            <SkeletonBlock className="page-skeleton__admin-brand-copy" />
          </div>
          <div className="page-skeleton__admin-nav">
            {Array.from({ length: ADMIN_SKELETON_TABS.length }, (_, index) => (
              <div key={ADMIN_SKELETON_TABS[index]} className={`page-skeleton__admin-nav-item${index === activeNavIndex ? ' page-skeleton__admin-nav-item--active' : ''}`}>
                <SkeletonBlock className="page-skeleton__admin-nav-icon" />
                <SkeletonBlock className="page-skeleton__admin-nav-label" />
                <SkeletonBlock className="page-skeleton__admin-nav-index" />
              </div>
            ))}
          </div>
          <SkeletonBlock className="page-skeleton__admin-sidebar-action" />
        </aside>
        <main className="page-skeleton__admin-main">
          <header className="page-skeleton__admin-topbar">
            <SkeletonBlock className="page-skeleton__admin-topbar-title" />
            <div className="page-skeleton__admin-topbar-actions">
              <SkeletonBlock className="page-skeleton__admin-topbar-wordmark" />
              <SkeletonBlock className="page-skeleton__admin-topbar-nav" />
              <SkeletonBlock className="page-skeleton__admin-topbar-nav" />
            </div>
          </header>
          <div className="page-skeleton__admin-content">
            {isJobs && (
              <>
            <SkeletonPanel className="page-skeleton__admin-hero">
              <div className="page-skeleton__admin-hero-copy">
                <SkeletonBlock className="page-skeleton__admin-eyebrow" />
                <SkeletonBlock className="page-skeleton__admin-title" />
                <SkeletonLines count={2} className="page-skeleton__admin-intro" />
                <div className="page-skeleton__admin-hero-meta"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
              </div>
              <div className="page-skeleton__admin-hero-actions">
                <SkeletonBlock className="page-skeleton__admin-hero-badge" />
                <SkeletonBlock className="page-skeleton__admin-hero-cta" />
              </div>
            </SkeletonPanel>

            <div className="page-skeleton__admin-metric-grid">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonPanel key={index} className="page-skeleton__admin-metric-card">
                  <SkeletonBlock className="page-skeleton__admin-metric-label" />
                  <SkeletonBlock className="page-skeleton__admin-metric-value" />
                  <SkeletonBlock className="page-skeleton__admin-metric-copy" />
                </SkeletonPanel>
              ))}
            </div>
              </>
            )}

            {isJobs && (
              <SkeletonPanel className="page-skeleton__admin-spotlight">
                <div className="page-skeleton__admin-spotlight-copy">
                  <SkeletonBlock className="page-skeleton__admin-eyebrow" />
                  <SkeletonBlock className="page-skeleton__admin-spotlight-title" />
                  <SkeletonLines count={2} className="page-skeleton__admin-spotlight-intro" />
                  <div className="page-skeleton__admin-spotlight-meta"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
                </div>
                <div className="page-skeleton__admin-spotlight-stats">
                  {Array.from({ length: 3 }, (_, index) => (
                    <SkeletonPanel key={index} className="page-skeleton__admin-spotlight-stat">
                      <SkeletonBlock />
                      <SkeletonBlock />
                    </SkeletonPanel>
                  ))}
                </div>
              </SkeletonPanel>
            )}

            {isJobs ? (
              <div className="page-skeleton__admin-workspace">
                <SkeletonPanel className="page-skeleton__admin-terminal">
                  <div className="page-skeleton__admin-terminal-toolbar">
                    <div className="page-skeleton__admin-table-title">
                      <div className="page-skeleton__admin-terminal-heading">
                        <SkeletonBlock className="page-skeleton__admin-terminal-title" />
                        <SkeletonBlock className="page-skeleton__admin-terminal-copy" />
                      </div>
                      <div className="page-skeleton__admin-table-pills"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
                    </div>
                    <div className="page-skeleton__admin-terminal-actions">
                      <SkeletonBlock className="page-skeleton__admin-table-search" />
                      <SkeletonBlock className="page-skeleton__admin-table-clear" />
                      <SkeletonBlock className="page-skeleton__admin-table-download" />
                    </div>
                  </div>
                  <div className="page-skeleton__admin-job-group">
                    <div className="page-skeleton__admin-job-group-head"><SkeletonBlock /><SkeletonBlock /></div>
                    <div className="page-skeleton__admin-job-list">
                      {Array.from({ length: 4 }, (_, index) => (
                        <div key={index} className="page-skeleton__admin-job-row">
                          <SkeletonBlock className="page-skeleton__admin-job-trace" />
                          <div className="page-skeleton__admin-job-primary"><SkeletonBlock /><SkeletonBlock /></div>
                          <div className="page-skeleton__admin-job-status"><SkeletonBlock /><SkeletonBlock /></div>
                          <div className="page-skeleton__admin-job-summary"><SkeletonBlock /><SkeletonBlock /></div>
                          <div className="page-skeleton__admin-job-counts"><SkeletonBlock /><SkeletonBlock /></div>
                          <SkeletonBlock className="page-skeleton__admin-job-ops" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="page-skeleton__admin-terminal-footer"><SkeletonBlock /><SkeletonBlock /></div>
                </SkeletonPanel>

                <SkeletonPanel className="page-skeleton__admin-detail">
                  <div className="page-skeleton__admin-detail-head">
                    <SkeletonBlock className="page-skeleton__admin-eyebrow" />
                    <SkeletonBlock className="page-skeleton__admin-detail-title" />
                    <SkeletonLines count={2} />
                    <SkeletonBlock className="page-skeleton__admin-detail-state" />
                  </div>
                  <div className="page-skeleton__admin-detail-badges"><SkeletonBlock /><SkeletonBlock /></div>
                  <div className="page-skeleton__admin-detail-progress"><SkeletonBlock /><SkeletonBlock /></div>
                  <div className="page-skeleton__admin-detail-grid">
                    {Array.from({ length: 6 }, (_, index) => (
                      <div key={index} className="page-skeleton__admin-detail-stat"><SkeletonBlock /><SkeletonBlock /></div>
                    ))}
                  </div>
                  <div className="page-skeleton__admin-detail-shell"><SkeletonBlock /><SkeletonLines count={2} /></div>
                  <div className="page-skeleton__admin-detail-shell"><SkeletonBlock /><SkeletonLines count={3} /></div>
                </SkeletonPanel>
              </div>
            ) : <AdminRouteSkeleton activeTab={activeTab} />}
          </div>
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
        <SkeletonBlock className="page-skeleton__heatmap-canvas" />
        <aside className="page-skeleton__heatmap-legend">
          <SkeletonBlock className="page-skeleton__heatmap-card-kicker" />
          <div className="page-skeleton__heatmap-legend-scale">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="page-skeleton__heatmap-legend-band" key={index}>
                <SkeletonBlock className="page-skeleton__heatmap-legend-band-label" />
                <SkeletonBlock className="page-skeleton__heatmap-legend-band-swatch" />
              </div>
            ))}
          </div>
        </aside>
        <div className="page-skeleton__heatmap-utility-rail">
          {Array.from({ length: 9 }, (_, index) => <SkeletonBlock key={`quick-${index}`} />)}
          <span className="page-skeleton__heatmap-utility-divider" aria-hidden="true" />
          {Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={`map-${index}`} />)}
        </div>
      </div>
    </div>
  );
}

function RunnerPageSkeleton({ variant = 'runner', activeTab = 'overview' }) {
  if (variant === 'admin') return <AdminPageSkeleton activeTab={activeTab} />;
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
      <div className="recent-runs-shell runs-dashboard-shell runs-profile-history runs-ledger-redesign page-skeleton__runs-shell">
      <div className="runs-profile-cockpit page-skeleton__runs-cockpit-shell">
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
      </div>
      <div className="runs-profile-glance page-skeleton__runs-glance">
      <SkeletonStats count={3} className="page-skeleton__runs-stats" />
      <div className="page-skeleton__runs-insight-strip">
        <SkeletonPanel className="page-skeleton__runs-insight page-skeleton__runs-insight--primary"><SkeletonBlock className="page-skeleton__runs-insight-label" /><SkeletonBlock className="page-skeleton__runs-insight-value" /><SkeletonBlock className="page-skeleton__runs-insight-note" /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__runs-insight"><SkeletonBlock className="page-skeleton__runs-insight-label" /><SkeletonBlock className="page-skeleton__runs-insight-value" /><SkeletonBlock className="page-skeleton__runs-insight-note" /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__runs-insight"><SkeletonBlock className="page-skeleton__runs-insight-label" /><SkeletonBlock className="page-skeleton__runs-insight-value" /><SkeletonBlock className="page-skeleton__runs-insight-note" /></SkeletonPanel>
      </div>
      </div>
      <div className="recent-runs-chip-stack runs-profile-workbench page-skeleton__runs-workbench-shell">
      <SkeletonPanel className="page-skeleton__runs-workbench">
        <SkeletonBlock className="page-skeleton__runs-search" />
        <div className="page-skeleton__runs-filters">
          <div className="page-skeleton__runs-chip-row">
            {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className={`page-skeleton__runs-chip${index === 0 ? ' page-skeleton__runs-chip--active' : ''}`} />)}
          </div>
          <div className="page-skeleton__runs-chip-row page-skeleton__runs-chip-row--secondary">
            {Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} className="page-skeleton__runs-chip" />)}
          </div>
        </div>
      </SkeletonPanel>
      </div>
      <div className="recent-runs-card-list page-skeleton__runs-card-list">
      <div className="page-skeleton__runs-history">
        {[16, 14, 13].map((cardCount, groupIndex) => (
          <SkeletonPanel key={groupIndex} className="page-skeleton__runs-month">
            <div className="page-skeleton__runs-month-header"><SkeletonBlock className="page-skeleton__runs-month-chevron" /><SkeletonBlock className="page-skeleton__runs-month-label" /><SkeletonBlock className="page-skeleton__runs-month-meta" /></div>
            <div className="page-skeleton__runs-card-grid">
              {Array.from({ length: cardCount }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__runs-card"><SkeletonBlock className="page-skeleton__runs-card-thumb" /><div className="page-skeleton__runs-card-copy"><SkeletonBlock className="page-skeleton__runs-card-title" /><SkeletonBlock className="page-skeleton__runs-card-date" /><div className="page-skeleton__runs-card-metrics"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></div></SkeletonPanel>)}
            </div>
          </SkeletonPanel>
        ))}
      </div>
      </div>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'run-detail') {
    return <RunnerFrame variant={variant}>
      <div className="run-detail-shell page-skeleton__run-detail-shell">
      <section className="run-detail-overview-card page-skeleton__run-detail-overview">
      <div className="page-skeleton__run-detail-overview-head"><SkeletonBlock className="page-skeleton__panel-title" /></div>
      <div className="page-skeleton__run-detail-stat-grid">{Array.from({ length: 3 }, (_, index) => <div key={index} className="page-skeleton__run-detail-stat"><SkeletonBlock /><SkeletonBlock /></div>)}</div>
      <div className="page-skeleton__run-detail-content-grid">
        <SkeletonPanel className="page-skeleton__run-detail-debrief"><SkeletonBlock className="page-skeleton__run-detail-card-kicker" /><div className="page-skeleton__run-detail-debrief-panel"><SkeletonBlock className="page-skeleton__run-detail-debrief-mark" /><SkeletonLines count={4} /></div></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__run-detail-gear"><SkeletonBlock className="page-skeleton__run-detail-card-kicker" /><div className="page-skeleton__run-detail-gear-body"><SkeletonBlock className="page-skeleton__run-detail-gear-art" /><div><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></div><div className="page-skeleton__runs-actions"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel>
      </div>
      <div className="page-skeleton__run-detail-summary-grid"><SkeletonPanel className="page-skeleton__run-detail-comparison"><SkeletonBlock className="page-skeleton__run-detail-card-kicker" /><SkeletonLines count={2} /><div className="page-skeleton__run-detail-comparison-grid"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel></div>
      </section>
      <section className="run-detail-section run-detail-telemetry-section page-skeleton__run-detail-telemetry-section">
      <SkeletonPanel className="page-skeleton__run-detail-telemetry">
        <div className="page-skeleton__run-detail-section-head"><SkeletonBlock className="page-skeleton__panel-title" /></div>
        <div className="page-skeleton__run-detail-tabs">{Array.from({ length: 6 }, (_, index) => <div key={index} className={`page-skeleton__run-detail-tab${index === 0 ? ' page-skeleton__run-detail-tab--active' : ''}`} />)}</div>
        <div className="page-skeleton__run-detail-stage"><div className="page-skeleton__run-detail-readout"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock className="page-skeleton__chart page-skeleton__chart--tall" /></div>
        <div className="page-skeleton__run-detail-chip-row"><SkeletonBlock /><SkeletonBlock /></div>
        <div className="page-skeleton__run-detail-tile-grid">{Array.from({ length: 2 }, (_, index) => <div key={`effect-${index}`} className="page-skeleton__run-detail-tile"><SkeletonBlock /><SkeletonBlock /></div>)}</div>
        <div className="page-skeleton__run-detail-tile-grid">{Array.from({ length: 2 }, (_, index) => <div key={`unavail-${index}`} className="page-skeleton__run-detail-tile"><SkeletonBlock /><SkeletonBlock /></div>)}</div>
      </SkeletonPanel>
      </section>
      <section className="run-detail-section run-detail-splits-section page-skeleton__run-detail-splits-section">
      <SkeletonPanel className="page-skeleton__run-detail-table">
        <div className="page-skeleton__run-detail-table-head"><SkeletonBlock className="page-skeleton__panel-title" /></div>
        <div className="page-skeleton__run-detail-table-grid">
          <div className="page-skeleton__run-detail-table-row page-skeleton__run-detail-table-row--head">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div>
          {Array.from({ length: 5 }, (_, rowIndex) => <div key={rowIndex} className="page-skeleton__run-detail-table-row">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div>)}
        </div>
      </SkeletonPanel>
      </section>
      </div>
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
          <div className="page-skeleton__analysis-legend">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div>
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
              {Array.from({ length: tableIndex === 0 ? 5 : 4 }, (_, rowIndex) => (
                <div key={rowIndex} className="page-skeleton__analysis-table-row"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
              ))}
            </div>
            {tableIndex === 1 && <div className="page-skeleton__runs-actions"><SkeletonBlock /><SkeletonBlock /></div>}
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
      <div className="weather-engine-hero-shell page-skeleton__weather-hero-shell"><SkeletonPanel className="page-skeleton__weather-hero">
        <div className="page-skeleton__weather-copy"><SkeletonBlock className="page-skeleton__weather-kicker" /><SkeletonBlock className="page-skeleton__weather-title" /><SkeletonLines count={2} /><div className="page-skeleton__weather-chips">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></div>
        <div className="page-skeleton__weather-metrics">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__weather-metric"><SkeletonBlock className="page-skeleton__weather-icon" /><SkeletonBlock className="page-skeleton__weather-metric-label" /><SkeletonBlock className="page-skeleton__weather-temp" /></SkeletonPanel>)}</div>
      </SkeletonPanel></div>
      <div className="weather-engine-forecast-panel page-skeleton__weather-forecast-shell"><SkeletonPanel className="page-skeleton__weather-forecast"><SkeletonBlock className="page-skeleton__weather-section-title" /><div className="page-skeleton__forecast-row">{Array.from({ length: 12 }, (_, index) => <SkeletonBlock key={index} />)}</div></SkeletonPanel></div>
      <div className="weather-engine-analysis-grid page-skeleton__weather-lower-grid"><SkeletonPanel className="page-skeleton__weather-engine"><SkeletonBlock className="page-skeleton__weather-section-kicker" /><SkeletonBlock className="page-skeleton__weather-section-title" /><SkeletonLines count={3} /><div className="page-skeleton__weather-engine-meter"><SkeletonBlock /><SkeletonBlock /></div><div className="page-skeleton__weather-engine-stats">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></SkeletonPanel><SkeletonPanel className="page-skeleton__weather-coach"><SkeletonBlock className="page-skeleton__weather-section-kicker" /><SkeletonBlock className="page-skeleton__weather-section-title" /><SkeletonLines count={4} /><SkeletonRows count={3} /><div className="page-skeleton__weather-coach-actions"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel></div>
    </RunnerFrame>;
  }

  if (variant === 'analysis-load') {
    return <RunnerFrame variant={variant}>
      <div className="analysis-load-profile page-skeleton__analysis-load"><SkeletonPanel className="analysis-load-profile-decision"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={4} /><SkeletonBlock className="page-skeleton__analysis-decision-spine" /></SkeletonPanel><div className="analysis-load-profile-evidence page-skeleton__analysis-load-evidence"><SkeletonPanel className="page-skeleton__analysis-load-chart"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__chart page-skeleton__chart--tall" /></SkeletonPanel><SkeletonPanel className="page-skeleton__analysis-load-ratio"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__analysis-load-ratio-ring" /><SkeletonLines count={2} /></SkeletonPanel></div><SkeletonPanel className="analysis-load-profile-metrics"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonStats count={4} /></SkeletonPanel><SkeletonPanel className="analysis-load-profile-ledger"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={3} /></SkeletonPanel></div>
    </RunnerFrame>;
  }

  if (variant === 'analysis-intensity') {
    return <RunnerFrame variant={variant}>
      <div className="analysis-intensity-profile-content page-skeleton__analysis-intensity"><SkeletonPanel className="analysis-intensity-command-hero"><div className="page-skeleton__analysis-intensity-hero-copy"><SkeletonBlock className="page-skeleton__insight-kicker" /><SkeletonBlock className="page-skeleton__insight-title" /><SkeletonLines count={2} /></div><div className="page-skeleton__analysis-intensity-hero-stats"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel><div className="analysis-intensity-command-grid"><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__chart page-skeleton__chart--tall" /></SkeletonPanel><div className="page-skeleton__analysis-intensity-sidebar"><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={3} /></SkeletonPanel><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={3} /></SkeletonPanel></div></div><div className="analysis-intensity-command-samples"><SkeletonBlock className="page-skeleton__panel-title" /><div className="page-skeleton__analysis-intensity-sample-grid">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={2} /></SkeletonPanel>)}</div></div></div>
    </RunnerFrame>;
  }

  if (variant === 'analysis-injury') {
    return <RunnerFrame variant={variant}>
      <div className="analysis-profile-v2 analysis-profile-v2--injury page-skeleton__analysis-injury-profile"><SkeletonPanel className="analysis-cinematic-card analysis-cinematic-card--coach"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={5} /></SkeletonPanel><section className="analysis-cinematic-signal-row"><SkeletonStats count={3} /></section><div className="analysis-cinematic-grid"><SkeletonPanel className="page-skeleton__analysis-injury-samples"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={6} /></SkeletonPanel><SkeletonPanel className="page-skeleton__analysis-injury-trend"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__chart page-skeleton__chart--tall" /><div className="page-skeleton__analysis-injury-support">{Array.from({ length: 3 }, (_, index) => <div key={index} className="page-skeleton__analysis-injury-support-card"><SkeletonBlock /><SkeletonBlock /></div>)}</div></SkeletonPanel></div></div>
    </RunnerFrame>;
  }

  if (variant === 'analysis-coach') {
    return <RunnerFrame variant={variant}>
      <div className="analysis-coach-profile page-skeleton__analysis-coach"><SkeletonPanel className="analysis-profile-v2-header"><SkeletonBlock className="page-skeleton__insight-kicker" /><SkeletonBlock className="page-skeleton__insight-title" /><SkeletonLines count={2} /></SkeletonPanel><SkeletonPanel className="analysis-coach-profile-decision"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={6} /></SkeletonPanel><div className="analysis-coach-profile-workbench"><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={10} /></SkeletonPanel><SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={8} /></SkeletonPanel></div><div className="analysis-coach-profile-evidence">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={3} /></SkeletonPanel>)}</div></div>
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
      <div className="page-skeleton__shoes-screen">
      <div className="page-skeleton__shoes-summary">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__shoes-summary-tile"><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>)}</div>
      <div className="page-skeleton__shoes-stage">
        <div className="page-skeleton__shoes-workspace-head">
          <div className="page-skeleton__shoes-workspace-copy">
            <SkeletonBlock className="page-skeleton__shoes-title" />
            <SkeletonBlock className="page-skeleton__shoes-subtitle" />
          </div>
          <div className="page-skeleton__shoes-toolbar">
            <SkeletonBlock className="page-skeleton__shoes-search" />
            <SkeletonBlock className="page-skeleton__shoes-scan" />
            <SkeletonBlock className="page-skeleton__shoes-add" />
          </div>
        </div>
        <div className="page-skeleton__shoes-tabs">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div>
        <SkeletonPanel className="page-skeleton__shoes-filterbar">
          <div className="page-skeleton__shoes-filterbar-head"><SkeletonBlock className="page-skeleton__shoes-card-kicker" /><SkeletonBlock className="page-skeleton__shoes-filter-reset" /></div>
          <div className="page-skeleton__shoes-manage-grid">{Array.from({ length: 3 }, (_, index) => <div key={index}><SkeletonBlock className="page-skeleton__shoes-card-kicker" /><div>{Array.from({ length: index === 0 ? 3 : index === 1 ? 4 : 4 }, (_, pillIndex) => <SkeletonBlock key={pillIndex} />)}</div></div>)}</div>
        </SkeletonPanel>
        <div className="page-skeleton__shoes-inventory-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonPanel key={index} className="page-skeleton__shoes-inventory-card">
              <div className="page-skeleton__shoes-inventory-card-top"><SkeletonBlock className="page-skeleton__shoes-inventory-art" /><div className="page-skeleton__shoes-inventory-copy"><SkeletonBlock className="page-skeleton__shoes-inventory-title" /><SkeletonLines count={2} /></div><SkeletonBlock className="page-skeleton__shoes-inventory-chevron" /></div>
              <div className="page-skeleton__shoes-inventory-metrics"><SkeletonBlock /><SkeletonBlock /></div>
              <div className="page-skeleton__shoes-inventory-actions">{Array.from({ length: 4 }, (_, actionIndex) => <SkeletonBlock key={actionIndex} />)}</div>
            </SkeletonPanel>
          ))}
        </div>
      </div>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'shoe-catalog') {
    return <RunnerFrame variant={variant}>
      <div className="add-shoes-shell page-skeleton__catalog-shell">
      <div className="add-shoes-browser-panel shoe-catalog-browser-panel page-skeleton__catalog-browser">
      <div className="page-skeleton__catalog-browser-head"><div className="page-skeleton__catalog-title-wrap"><SkeletonBlock className="page-skeleton__shoes-card-kicker" /><SkeletonBlock className="page-skeleton__catalog-title" /></div><div className="page-skeleton__catalog-search-wrap"><SkeletonBlock className="page-skeleton__catalog-search" /><SkeletonBlock className="page-skeleton__catalog-clear" /></div></div>
      <div className="page-skeleton__catalog-browser-layout">
        <div className="page-skeleton__catalog-brand-rail">{Array.from({ length: 5 }, (_, index) => <div key={index} className="page-skeleton__catalog-brand-item"><SkeletonBlock className="page-skeleton__catalog-brand-logo" /><div><SkeletonBlock /><SkeletonBlock /></div></div>)}</div>
        <div className="page-skeleton__catalog-model-shell">
          <div className="page-skeleton__catalog-model-head"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__catalog-model-count" /></div>
          <SkeletonPanel className="page-skeleton__catalog-model-empty"><SkeletonBlock className="page-skeleton__catalog-empty-icon" /><SkeletonBlock className="page-skeleton__catalog-empty-title" /><SkeletonLines count={2} /></SkeletonPanel>
        </div>
      </div>
      </div>
      <div className="add-shoes-side-rail page-skeleton__catalog-side-rail">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__catalog-side-card"><SkeletonBlock className="page-skeleton__shoes-card-kicker" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={2} /></SkeletonPanel>)}</div>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'races') {
    return <RunnerFrame variant={variant}>
      <div className="race-center-content page-skeleton__races-content">
      <section className="race-center-hero page-skeleton__races-hero"><div className="page-skeleton__races-hero-body"><SkeletonBlock className="page-skeleton__races-hero-chip" /><SkeletonBlock className="page-skeleton__races-hero-title" /><SkeletonBlock className="page-skeleton__copy page-skeleton__copy--short" /><div className="page-skeleton__runs-actions"><SkeletonBlock /><SkeletonBlock /></div></div></section>
      <section className="race-center-section race-center-discovery page-skeleton__races-discovery">
        <div className="page-skeleton__races-discovery-head"><div><SkeletonBlock className="page-skeleton__races-section-title" /><SkeletonBlock className="page-skeleton__copy page-skeleton__copy--short" /></div><SkeletonBlock className="page-skeleton__races-head-link" /></div>
        <SkeletonBlock className="page-skeleton__races-toolbar" />
        <div className="page-skeleton__races-filter-strip">
          <div className="page-skeleton__races-filter-row">{Array.from({ length: 6 }, (_, index) => <SkeletonBlock key={`country-${index}`} className="page-skeleton__races-filter-chip" />)}</div>
          <div className="page-skeleton__races-filter-row">{Array.from({ length: 5 }, (_, index) => <SkeletonBlock key={`dist-${index}`} className="page-skeleton__races-filter-chip" />)}</div>
          <div className="page-skeleton__races-filter-row">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={`month-${index}`} className="page-skeleton__races-filter-chip" />)}</div>
        </div>
        <SkeletonPanel className="page-skeleton__races-featured"><div className="page-skeleton__races-featured-art" /><div className="page-skeleton__races-featured-body"><SkeletonBlock /><SkeletonBlock /><div className="page-skeleton__runs-actions"><SkeletonBlock /><SkeletonBlock /></div></div></SkeletonPanel>
        <div className="page-skeleton__race-grid">{Array.from({ length: 6 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__races-card"><div className="page-skeleton__races-card-art" /><div className="page-skeleton__races-card-body"><SkeletonBlock className="page-skeleton__race-date" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__copy page-skeleton__copy--short" /></div></SkeletonPanel>)}</div>
      </section>
      <section className="race-center-section race-center-calendar page-skeleton__races-calendar"><div className="page-skeleton__races-discovery-head"><div><SkeletonBlock className="page-skeleton__races-section-title" /><SkeletonBlock className="page-skeleton__copy page-skeleton__copy--short" /></div><SkeletonBlock className="page-skeleton__races-head-link" /></div><div className="page-skeleton__races-agenda">{Array.from({ length: 4 }, (_, index) => <div key={index} className="page-skeleton__races-agenda-row"><SkeletonBlock className="page-skeleton__races-agenda-countdown" /><div className="page-skeleton__runs-card-copy"><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock className="page-skeleton__races-agenda-status" /></div>)}</div></section>
      <section className="race-center-section race-center-pb-section page-skeleton__races-pb"><div className="page-skeleton__races-discovery-head"><div><SkeletonBlock className="page-skeleton__races-section-title" /><SkeletonBlock className="page-skeleton__copy page-skeleton__copy--short" /></div><SkeletonBlock className="page-skeleton__races-head-chip" /></div><div className="page-skeleton__races-pb-grid">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__races-pb-card"><SkeletonBlock className="page-skeleton__race-date" /><SkeletonBlock className="page-skeleton__runs-signal-value" /><SkeletonBlock className="page-skeleton__copy page-skeleton__copy--short" /></SkeletonPanel>)}</div></section>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'race-detail') {
    return <RunnerFrame variant={variant}>
      <div className="race-detail-layout page-skeleton__race-detail-layout">
      <SkeletonPanel className="page-skeleton__race-detail-hero">
        <div className="page-skeleton__race-detail-hero-body">
          <div className="page-skeleton__race-detail-hero-main"><SkeletonBlock className="page-skeleton__race-detail-pill" /><SkeletonBlock className="page-skeleton__races-hero-title" /><div className="page-skeleton__run-detail-map-meta"><SkeletonBlock /><SkeletonBlock /></div></div>
          <div className="page-skeleton__countdown">{Array.from({ length: 4 }, (_, index) => <div key={index} className="page-skeleton__race-detail-count-card" />)}</div>
        </div>
      </SkeletonPanel>
      <div className="page-skeleton__race-detail-grid">
        <div className="page-skeleton__race-detail-command-strip">
          <div className="page-skeleton__race-detail-stats">{Array.from({ length: 2 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__race-detail-stat-card"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>)}</div>
          <SkeletonPanel className="page-skeleton__race-detail-coach"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={3} /><div className="page-skeleton__run-detail-map-meta"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel>
        </div>
        <SkeletonPanel className="page-skeleton__race-detail-course"><div className="page-skeleton__run-detail-table-head"><SkeletonBlock className="page-skeleton__panel-title" /></div><div className="page-skeleton__run-detail-map-meta"><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock className="page-skeleton__race-detail-elevation" /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__race-detail-map-stage" />
      </div>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'schedule') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="page-skeleton__schedule-command">
        <div className="page-skeleton__schedule-command-copy">
          <SkeletonBlock className="page-skeleton__schedule-title" />
          <div className="page-skeleton__schedule-chips"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
        </div>
        <div className="page-skeleton__schedule-command-metrics">
          {Array.from({ length: 2 }, (_, index) => <div key={index} className="page-skeleton__schedule-command-metric"><SkeletonBlock className="page-skeleton__schedule-command-metric-label" /><SkeletonBlock className="page-skeleton__schedule-command-metric-value" /></div>)}
        </div>
        <SkeletonBlock className="page-skeleton__schedule-command-pulse" />
      </SkeletonPanel>
      <div className="page-skeleton__schedule-week-grid">{Array.from({ length: 7 }, (_, index) => <SkeletonPanel key={index} className={`page-skeleton__schedule-day${index === 2 ? ' page-skeleton__schedule-day--active' : ''}`}><SkeletonBlock /><SkeletonBlock /><SkeletonLines count={2} /><SkeletonBlock /></SkeletonPanel>)}</div>
      <div className="page-skeleton__schedule-bottom-grid">
        <div className="page-skeleton__schedule-left-rail">
          <div className="page-skeleton__schedule-dual-grid"><SkeletonPanel className="page-skeleton__schedule-readiness"><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonBlock className="page-skeleton__schedule-readiness-ring" /><SkeletonBlock className="page-skeleton__schedule-score" /><SkeletonLines count={2} /></SkeletonPanel><SkeletonPanel className="page-skeleton__schedule-next"><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonBlock className="page-skeleton__schedule-next-title" /><SkeletonLines count={3} /><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel></div>
          <SkeletonPanel className="page-skeleton__schedule-route"><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonBlock className="page-skeleton__schedule-route-map" /><div className="page-skeleton__schedule-route-meta"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel>
        </div>
        <div className="page-skeleton__schedule-right-rail"><SkeletonPanel className="page-skeleton__schedule-coach-card"><div className="page-skeleton__schedule-coach-head"><div><SkeletonBlock className="page-skeleton__schedule-card-kicker" /><SkeletonBlock className="page-skeleton__schedule-coach-title" /></div><SkeletonBlock className="page-skeleton__schedule-coach-avatar" /></div><SkeletonBlock className="page-skeleton__schedule-coach-summary" /><SkeletonLines count={3} /><div className="page-skeleton__schedule-coach-focus">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div><div className="page-skeleton__schedule-coach-signals">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel><SkeletonPanel className="page-skeleton__schedule-gear"><div className="page-skeleton__schedule-card-kicker" /><div className="page-skeleton__schedule-gear-row"><SkeletonBlock className="page-skeleton__schedule-gear-thumb" /><div className="page-skeleton__schedule-gear-copy"><SkeletonBlock /><SkeletonBlock /></div></div><SkeletonBlock className="page-skeleton__schedule-gear-meter" /></SkeletonPanel></div>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'today-run') {
    return <RunnerFrame variant={variant}>
      <section className="today-run-coaching-strip page-skeleton__today-coaching">
        <div className="page-skeleton__today-coaching-grid" aria-hidden="true">
          <SkeletonPanel className="page-skeleton__today-coaching-card page-skeleton__today-coaching-card--lead"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>
          <SkeletonPanel className="page-skeleton__today-coaching-card"><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>
          <SkeletonPanel className="page-skeleton__today-coaching-card"><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>
          <SkeletonPanel className="page-skeleton__today-coaching-card"><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>
          <SkeletonPanel className="page-skeleton__today-coaching-card"><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>
        </div>
      </section>
      <div className="today-run-plan-hero page-skeleton__today-plan-hero"><SkeletonPanel className="page-skeleton__today-command">
        <div className="page-skeleton__today-command-copy">
          <SkeletonBlock className="page-skeleton__today-kicker" />
          <SkeletonBlock className="page-skeleton__today-title" />
          <SkeletonBlock className="page-skeleton__today-briefing" />
          <div className="page-skeleton__today-badges"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
          <SkeletonStats count={4} className="page-skeleton__today-stats" />
        </div>
        <div className="page-skeleton__today-readiness-panel"><SkeletonBlock className="page-skeleton__today-card-kicker" /><div className="page-skeleton__today-readiness-grid"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></div>
      </SkeletonPanel></div>
      <div className="today-run-plan-grid page-skeleton__today-plan-grid"><div className="today-run-plan-left page-skeleton__today-plan-left"><SkeletonPanel className="page-skeleton__today-blueprint"><SkeletonBlock className="page-skeleton__today-card-kicker" /><SkeletonBlock className="page-skeleton__panel-title" /><div className="page-skeleton__today-blueprint-steps">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock /><SkeletonBlock /><SkeletonLines count={2} /></SkeletonPanel>)}</div></SkeletonPanel></div><div className="today-run-plan-right page-skeleton__today-plan-right"><SkeletonPanel className="page-skeleton__today-coach"><div className="page-skeleton__today-coach-head"><SkeletonBlock className="page-skeleton__today-card-kicker" /><SkeletonBlock className="page-skeleton__today-coach-avatar" /></div><SkeletonBlock className="page-skeleton__today-coach-title" /><SkeletonLines count={3} /><div className="page-skeleton__today-coach-reasons">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div><div className="page-skeleton__today-coach-metrics">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} />)}</div><SkeletonBlock className="page-skeleton__today-shoe-brief" /><div className="page-skeleton__today-coach-actions">{Array.from({ length: 2 }, (_, index) => <SkeletonBlock key={index} />)}</div></SkeletonPanel></div></div>
    </RunnerFrame>;
  }

  if (variant === 'prediction') {
    return <RunnerFrame variant={variant}>
      <div className="page-skeleton__prediction-content">
      <SkeletonPanel className="page-skeleton__prediction-command"><div>{commonHeader}<SkeletonLines count={2} /><div className="page-skeleton__prediction-actions"><SkeletonBlock /><SkeletonBlock /></div></div><SkeletonBlock className="page-skeleton__prediction-time" /></SkeletonPanel>
      <div className="page-skeleton__prediction-evidence-grid page-skeleton__prediction-profile-metrics">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__prediction-main-value" /><SkeletonLines count={1} /></SkeletonPanel>)}</div>
      <SkeletonPanel className="page-skeleton__prediction-weather"><div className="page-skeleton__prediction-weather-head"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={2} /></div><div className="page-skeleton__prediction-weather-compare">{Array.from({ length: 3 }, (_, index) => <div key={index} className="page-skeleton__prediction-weather-tile"><SkeletonBlock /><SkeletonBlock /></div>)}</div></SkeletonPanel>
      <div className="page-skeleton__prediction-command-grid page-skeleton__prediction-profile-training"><SkeletonPanel className="page-skeleton__prediction-efforts"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={4} /></SkeletonPanel><SkeletonPanel className="page-skeleton__prediction-coach"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={3} /><SkeletonRows count={3} /></SkeletonPanel></div>
      <SkeletonPanel className="page-skeleton__prediction-profile-trend"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__chart page-skeleton__chart--tall" /></SkeletonPanel>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'muscle-training') {
    return <RunnerFrame variant={variant}>
      <div className="page-skeleton__muscle-above-fold">
        <SkeletonPanel className="page-skeleton__muscle-selector">
          <SkeletonBlock className="page-skeleton__muscle-section-title" />
          <SkeletonBlock className="page-skeleton__muscle-body-plate" />
          <div className="page-skeleton__muscle-recommendation-callout"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
          <div className="page-skeleton__muscle-toggles">{Array.from({ length: 6 }, (_, index) => <SkeletonBlock key={index} />)}</div>
        </SkeletonPanel>
        <SkeletonPanel className="page-skeleton__muscle-recommendations">
          <SkeletonBlock className="page-skeleton__muscle-section-title" />
          <SkeletonRows count={5} />
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
        <SkeletonPanel><SkeletonBlock className="page-skeleton__muscle-card-kicker" /><SkeletonBlock className="page-skeleton__panel-title" /><div className="page-skeleton__muscle-filter-row">{Array.from({ length: 7 }, (_, index) => <SkeletonBlock key={index} />)}</div><SkeletonRows count={6} /></SkeletonPanel>
      </div>
      <div className="page-skeleton__muscle-bottom-grid"><SkeletonPanel className="page-skeleton__muscle-activity"><div className="page-skeleton__muscle-card-kicker" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__muscle-activity-calendar" /><div className="page-skeleton__muscle-activity-legend"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel></div>
    </RunnerFrame>;
  }

  if (variant === 'rewards') {
    return <RunnerFrame variant={variant}>
      <div className="rewards-ledger-intro page-skeleton__rewards-intro"><SkeletonBlock className="page-skeleton__rewards-kicker" /><SkeletonBlock className="page-skeleton__rewards-title" /><SkeletonLines count={2} /></div>
      <div className="rewards-ledger-hero page-skeleton__rewards-hero"><SkeletonPanel className="rewards-ledger-hero-card page-skeleton__rewards-hero-card"><div className="page-skeleton__rewards-hero-head"><SkeletonBlock className="page-skeleton__rewards-hero-tag" /><SkeletonBlock className="page-skeleton__rewards-hero-counter" /></div><SkeletonBlock className="page-skeleton__rewards-hero-glyph" /><SkeletonBlock className="page-skeleton__rewards-hero-title" /><SkeletonLines count={2} /><SkeletonBlock className="page-skeleton__rewards-meter" /><div className="page-skeleton__today-coach-actions"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel><SkeletonPanel className="rewards-ledger-hero-card page-skeleton__rewards-hero-card"><div className="page-skeleton__rewards-hero-head"><SkeletonBlock className="page-skeleton__rewards-hero-tag" /><SkeletonBlock className="page-skeleton__rewards-hero-counter" /></div><SkeletonBlock className="page-skeleton__rewards-hero-glyph" /><SkeletonBlock className="page-skeleton__rewards-hero-title" /><SkeletonLines count={2} /><SkeletonBlock className="page-skeleton__rewards-meter" /><div className="page-skeleton__today-coach-actions"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel></div>
      <div className="rewards-ledger-metrics page-skeleton__rewards-stats">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__rewards-metric"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>)}</div>
      <section className="rewards-ledger-section page-skeleton__rewards-section"><div className="page-skeleton__rewards-section-head"><div><SkeletonBlock className="page-skeleton__rewards-card-kicker" /><SkeletonBlock className="page-skeleton__rewards-catalog-title" /></div><SkeletonBlock className="page-skeleton__rewards-section-count" /></div><div className="page-skeleton__rewards-earned-grid">{Array.from({ length: 6 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__rewards-earned-card"><SkeletonBlock className="page-skeleton__rewards-earned-icon" /><div><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel>)}</div></section>
      <section className="rewards-ledger-section page-skeleton__rewards-section page-skeleton__rewards-section--pipeline"><div className="page-skeleton__rewards-section-head"><div><SkeletonBlock className="page-skeleton__rewards-card-kicker" /><SkeletonBlock className="page-skeleton__rewards-catalog-title" /></div><SkeletonBlock className="page-skeleton__rewards-section-count" /></div><div className="page-skeleton__rewards-pipeline">{Array.from({ length: 3 }, (_, index) => <div key={index} className="page-skeleton__rewards-pipeline-row"><SkeletonBlock className="page-skeleton__rewards-pipeline-icon" /><SkeletonBlock className="page-skeleton__rewards-pipeline-glyph" /><div className="page-skeleton__rewards-pipeline-copy"><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock className="page-skeleton__rewards-pipeline-eta" /></div>)}</div></section>
      <section className="rewards-ledger-section rewards-ledger-catalog-section page-skeleton__rewards-catalog-section"><div className="page-skeleton__rewards-section-head"><div><SkeletonBlock className="page-skeleton__rewards-card-kicker" /><SkeletonBlock className="page-skeleton__rewards-catalog-title" /></div><SkeletonBlock className="page-skeleton__rewards-section-count" /></div><div className="page-skeleton__rewards-catalog-grid">{Array.from({ length: 131 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__rewards-badge-card"><SkeletonBlock className="page-skeleton__rewards-badge-icon" /><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>)}</div></section>
    </RunnerFrame>;
  }

  if (variant === 'settings') {
    return <RunnerFrame variant={variant}>
      <SkeletonPanel className="st-hero page-skeleton__settings-identity-hero">
        <div className="page-skeleton__settings-identity-copy">
          <div className="page-skeleton__settings-avatar-wrap"><SkeletonBlock className="page-skeleton__settings-avatar" /><SkeletonBlock className="page-skeleton__settings-avatar-badge" /></div>
          <div><SkeletonBlock className="page-skeleton__settings-identity-title" /><SkeletonLines count={2} /><div className="page-skeleton__settings-identity-chips">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></div>
        </div>
        <div className="page-skeleton__settings-completion"><SkeletonBlock className="page-skeleton__settings-completion-label" /><SkeletonBlock className="page-skeleton__settings-completion-value" /><SkeletonBlock className="page-skeleton__settings-completion-track" /></div>
      </SkeletonPanel>
      <SkeletonPanel className="st-activity-graph page-skeleton__settings-activity"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><SkeletonBlock className="page-skeleton__settings-activity-frame" /><div className="page-skeleton__settings-activity-legend"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel>
      <div className="st-main-grid page-skeleton__settings-content-grid">
        <SkeletonPanel className="page-skeleton__settings-profile"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><div className="page-skeleton__settings-field-group"><SkeletonBlock /><SkeletonBlock className="page-skeleton__settings-field" /></div><div className="page-skeleton__settings-field-group"><SkeletonBlock /><SkeletonBlock className="page-skeleton__settings-textarea" /></div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__settings-preferences"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><div className="page-skeleton__settings-preference-row"><div><SkeletonBlock /><SkeletonBlock /></div><div className="page-skeleton__settings-segmented">{Array.from({ length: 2 }, (_, index) => <SkeletonBlock key={index} />)}</div></div><div className="page-skeleton__settings-preference-row"><div><SkeletonBlock /><SkeletonBlock /></div><div className="page-skeleton__settings-theme-cards">{Array.from({ length: 2 }, (_, index) => <SkeletonBlock key={index} />)}</div></div><div className="page-skeleton__settings-preference-row"><div><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock className="page-skeleton__settings-select" /></div></SkeletonPanel>
      </div>
      <div className="st-main-grid page-skeleton__settings-bottom-grid">
        <SkeletonPanel className="page-skeleton__settings-checklist"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><SkeletonLines count={2} /><SkeletonRows count={4} /></SkeletonPanel>
        <SkeletonPanel className="page-skeleton__settings-weekly"><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><SkeletonLines count={2} /><div className="page-skeleton__settings-weekly-toggle"><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel>
      </div>
      <div className="st-services page-skeleton__settings-services-grid">
        <SkeletonPanel>
          <SkeletonBlock className="page-skeleton__settings-card-kicker" />
          <SkeletonBlock className="page-skeleton__settings-section-title" />
          <div className="page-skeleton__settings-services-inner">
            <div className="page-skeleton__settings-service-cards">{Array.from({ length: 2 }, (_, index) => <div key={index} className="page-skeleton__settings-service-card"><SkeletonBlock /><div><SkeletonBlock /><SkeletonBlock /></div><SkeletonBlock /></div>)}</div>
            <SkeletonBlock className="page-skeleton__settings-sync-title" />
            <SkeletonRows count={4} />
          </div>
        </SkeletonPanel>
      </div>
      <div className="st-bottom-grid page-skeleton__settings-final-grid"><SkeletonPanel><SkeletonBlock className="page-skeleton__settings-card-kicker" /><SkeletonBlock className="page-skeleton__settings-section-title" /><SkeletonLines count={4} /><SkeletonRows count={4} /></SkeletonPanel></div>
    </RunnerFrame>;
  }

  if (variant === 'garmin') {
    return <RunnerFrame variant={variant}>
      <div className="page-transition-shell garmin-import-page garmin-profile-page page-skeleton__garmin-shell">
        <div className="page-skeleton__garmin-hero">
          <div className="page-skeleton__garmin-hero-copy"><SkeletonBlock className="page-skeleton__eyebrow" /><SkeletonBlock className="page-skeleton__title" /><SkeletonLines count={2} /></div>
          <SkeletonBlock className="page-skeleton__garmin-device" />
        </div>
        <div className="page-skeleton__garmin-metric-strip">{Array.from({ length: 3 }, (_, index) => <SkeletonPanel key={index}><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></SkeletonPanel>)}</div>
        <div className="page-skeleton__garmin-content-grid">
          <SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonRows count={6} /><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel>
          <SkeletonPanel><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={5} /><div className="page-skeleton__garmin-status-grid">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div><SkeletonBlock className="page-skeleton__form-button" /></SkeletonPanel>
        </div>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'import-data') {
    return <RunnerFrame variant={variant}>
      <div className="page-transition-shell import-data-page page-skeleton__import-shell">
        <SkeletonPanel className="page-skeleton__import-card">
          <div className="page-skeleton__import-hero"><div>{commonHeader}<SkeletonLines count={2} /></div><SkeletonBlock className="page-skeleton__import-command-art" /></div>
          <div className="page-skeleton__import-lanes">{Array.from({ length: 4 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__import-source"><SkeletonBlock className="page-skeleton__import-source-icon" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={2} /><SkeletonBlock className="page-skeleton__form-field" /></SkeletonPanel>)}</div>
          <div className="page-skeleton__import-guide"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonLines count={3} /></div>
        </SkeletonPanel>
      </div>
    </RunnerFrame>;
  }

  if (variant === 'add-shoes') {
    return <RunnerFrame variant={variant}>
      <div className="add-shoes-catalog-workspace page-skeleton__add-shoes-workspace">
        <SkeletonPanel className="add-shoes-catalog-step add-shoes-step-card page-skeleton__add-shoes-step">
          <div className="page-skeleton__add-shoes-step-head"><SkeletonBlock className="page-skeleton__add-shoes-step-number" /><div><SkeletonBlock className="page-skeleton__add-shoes-step-title" /><SkeletonBlock className="page-skeleton__add-shoes-step-copy" /></div></div>
          <div className="page-skeleton__add-shoes-brand-deck">{Array.from({ length: 10 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__add-shoes-brand-tile"><SkeletonBlock className="page-skeleton__add-shoes-brand-logo" /><SkeletonBlock /></SkeletonPanel>)}</div>
        </SkeletonPanel>
        <SkeletonPanel className="add-shoes-catalog-step add-shoes-model-board add-shoes-step-card page-skeleton__add-shoes-models">
          <div className="page-skeleton__add-shoes-step-head"><SkeletonBlock className="page-skeleton__add-shoes-step-number" /><div><SkeletonBlock className="page-skeleton__add-shoes-step-title" /><SkeletonBlock className="page-skeleton__add-shoes-step-copy" /></div></div>
          <div className="page-skeleton__add-shoes-board-top"><div className="page-skeleton__add-shoes-chips">{Array.from({ length: 5 }, (_, index) => <SkeletonBlock key={index} />)}</div><SkeletonBlock className="page-skeleton__add-shoes-search" /></div>
          <div className="page-skeleton__add-shoes-board-shell">
            <div className="page-skeleton__add-shoes-model-head"><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__add-shoes-model-count" /></div>
            <div className="page-skeleton__add-shoes-model-grid">{Array.from({ length: 12 }, (_, index) => <SkeletonPanel key={index} className="page-skeleton__product-card"><SkeletonBlock className="page-skeleton__product-image" /><SkeletonBlock className="page-skeleton__panel-title" /><SkeletonBlock className="page-skeleton__copy page-skeleton__copy--short" /></SkeletonPanel>)}</div>
          </div>
        </SkeletonPanel>
        <SkeletonPanel className="add-shoes-step add-shoes-step--form add-shoes-step-card page-skeleton__add-shoes-setup">
          <div className="page-skeleton__add-shoes-step-head"><SkeletonBlock className="page-skeleton__add-shoes-step-number" /><div><SkeletonBlock className="page-skeleton__add-shoes-step-title" /><SkeletonBlock className="page-skeleton__add-shoes-step-copy" /></div></div>
          <div className="page-skeleton__add-shoes-payload">
            <SkeletonPanel className="page-skeleton__add-shoes-summary"><SkeletonBlock className="page-skeleton__shoes-card-kicker" /><div className="page-skeleton__add-shoes-summary-pills">{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} />)}</div></SkeletonPanel>
            <SkeletonPanel className="page-skeleton__add-shoes-form"><div className="page-skeleton__add-shoes-form-grid"><SkeletonBlock className="page-skeleton__form-field" /><SkeletonBlock className="page-skeleton__form-field" /><SkeletonBlock className="page-skeleton__form-field" /><SkeletonBlock className="page-skeleton__form-field" /></div><SkeletonBlock className="page-skeleton__form-toggle" /><div className="page-skeleton__today-coach-actions"><SkeletonBlock /><SkeletonBlock /></div></SkeletonPanel>
          </div>
        </SkeletonPanel>
      </div>
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
        <section className="page-skeleton__landing-feature-preview" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonPanel key={index}>
              <SkeletonBlock className="page-skeleton__landing-feature-icon" />
              <SkeletonBlock className="page-skeleton__landing-feature-title" />
              <SkeletonLines count={3} />
            </SkeletonPanel>
          ))}
        </section>
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

export default function PageSkeleton({ variant = 'runner', activeTab = 'overview' }) {
  if (variant === 'landing') return <LandingPageSkeleton />;
  if (['auth', 'login', 'signup', 'forgot-password', 'admin-login'].includes(variant)) return <AuthPageSkeleton variant={variant === 'login' ? 'auth' : variant} />;
  if (variant === 'legal') return <LegalPageSkeleton />;
  return <RunnerPageSkeleton variant={variant} activeTab={activeTab} />;
}
