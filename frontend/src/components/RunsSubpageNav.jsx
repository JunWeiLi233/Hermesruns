import { useEffect, useMemo, useState } from 'react';
import AppIcon from './AppIcon';
import HermesLogo from './HermesLogo';
import { formatDate } from '../utils/format';

const SECTION_ITEMS = [
  { id: 'run-detail-overview', labelKey: 'run_detail.subnav_overview', icon: 'route' },
  { id: 'run-detail-coach', labelKey: 'run_detail.subnav_coach', icon: 'coach_review', optional: 'coach' },
  { id: 'run-detail-comparison', labelKey: 'run_detail.subnav_comparison', icon: 'trending_up', optional: 'comparison' },
  { id: 'run-detail-telemetry', labelKey: 'run_detail.subnav_telemetry', icon: 'monitor_heart' },
  { id: 'run-detail-splits', labelKey: 'run_detail.subnav_splits', icon: 'splits' },
];

function getRunDate(run, lang, fallback) {
  const formatted = formatDate(run?.startTime || run?.startDate, lang);
  return formatted && formatted !== '--' ? formatted : fallback;
}

function RunSectionLink({ active, icon, label, sectionId }) {
  return (
    <a
      className={`runner-shell-side-link runs-subnav-link${active ? ' is-active' : ''}`}
      href={`#${sectionId}`}
      aria-current={active ? 'location' : undefined}
      title={label}
    >
      <AppIcon name={icon} className="runner-dashboard-side-link-icon" aria-hidden="true" />
      <span className="runs-subnav-link-copy">{label}</span>
    </a>
  );
}

function RecentRunLink({ index, lang, onSelect, run, t }) {
  const date = getRunDate(run, lang, t('run_detail.date_unavailable'));
  const name = run.name || t('run_detail.detail_title');

  return (
    <button type="button" className="runs-subnav-recent-link" onClick={() => onSelect(run)} title={name}>
      <span className="runs-subnav-recent-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <span className="runs-subnav-recent-copy">
        <strong>{name}</strong>
        <small>{date}</small>
      </span>
      <AppIcon name="chevron_right" aria-hidden="true" />
    </button>
  );
}

export default function RunsSubpageNav({
  collapsed,
  hasCoachReview,
  hasComparison,
  lang,
  navigate,
  onSelectRun,
  onToggle,
  recentRuns,
  run,
  showSections,
  t,
}) {
  const [activeSection, setActiveSection] = useState('run-detail-overview');
  const [recentRunsOpen, setRecentRunsOpen] = useState(false);
  const sectionItems = useMemo(() => SECTION_ITEMS.filter((item) => {
    if (!showSections) return false;
    if (item.optional === 'coach') return hasCoachReview;
    if (item.optional === 'comparison') return hasComparison;
    return true;
  }), [hasCoachReview, hasComparison, showSections]);
  const visibleRecentRuns = Array.isArray(recentRuns) ? recentRuns.slice(0, 4) : [];
  const runName = run?.name || t('run_detail.detail_title');
  const runDate = getRunDate(run, lang, t('run_detail.waiting_date'));

  useEffect(() => {
    setActiveSection('run-detail-overview');
    if (!showSections || typeof IntersectionObserver === 'undefined') return undefined;

    const targets = sectionItems
      .map((item) => document.getElementById(item.id))
      .filter(Boolean);
    if (!targets.length) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
      if (visibleEntry) setActiveSection(visibleEntry.target.id);
    }, { rootMargin: '-18% 0px -66% 0px', threshold: [0, 0.15, 0.45] });

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [run?.id, sectionItems, showSections]);

  return (
    <aside className="runner-shell-sidebar runs-subnav runs-subnav-analysis-rail">
      <div className="runner-shell-brand runner-dashboard-brand runs-subnav-header">
        <div className="runner-dashboard-brand-copy">
          <HermesLogo dark />
          <span>{t('run_detail.subnav_title')}</span>
        </div>
        <button
          type="button"
          className="runner-dashboard-sidebar-toggle"
          onClick={onToggle}
          aria-label={t(collapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
          aria-pressed={collapsed}
        >
          <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{collapsed ? '>' : '<'}</span>
        </button>
      </div>

      <div className="runs-subnav-current" aria-live="polite">
        <span className="runs-subnav-current-mark" aria-hidden="true"><AppIcon name="directions_run" /></span>
        <span className="runs-subnav-current-copy">
          <small>{t('run_detail.subnav_current')}</small>
          <strong>{runName}</strong>
          <span>{runDate}</span>
        </span>
      </div>

      <nav className="runner-shell-side-nav runs-subnav-nav" aria-label={t('run_detail.subnav_aria_label')}>
        <button type="button" className="runner-shell-side-link runs-subnav-overview-link" onClick={() => navigate('/runs')}>
          <AppIcon name="history" className="runner-dashboard-side-link-icon" aria-hidden="true" />
          <span className="runs-subnav-link-copy">{t('profile.dashboard_nav_activities')}</span>
        </button>

        {sectionItems.length > 0 && (
          <div className="runs-subnav-group runs-subnav-section-group">
            {sectionItems.map((item) => (
              <RunSectionLink
                key={item.id}
                active={item.id === activeSection}
                icon={item.icon}
                label={t(item.labelKey)}
                sectionId={item.id}
              />
            ))}
          </div>
        )}

        <div className="runs-subnav-group runs-subnav-recent-group">
            <button
              type="button"
              className="runner-shell-side-link runs-subnav-link runs-subnav-recent-toggle"
              aria-controls="runs-subnav-recent-list"
              aria-expanded={recentRunsOpen}
              onClick={() => setRecentRunsOpen((current) => !current)}
            >
              <AppIcon name="history" className="runner-dashboard-side-link-icon" aria-hidden="true" />
              <span className="runs-subnav-link-copy">{t('run_detail.subnav_recent')}</span>
            </button>
            {recentRunsOpen && (
              <div id="runs-subnav-recent-list" className="runs-subnav-recent-list">
                {visibleRecentRuns.map((recentRun, index) => (
                  <RecentRunLink
                    key={recentRun.id}
                    index={index}
                    lang={lang}
                    onSelect={(selectedRun) => {
                      setRecentRunsOpen(false);
                      onSelectRun(selectedRun);
                    }}
                    run={recentRun}
                    t={t}
                  />
                ))}
                <button
                  type="button"
                  className="runner-shell-side-link runs-subnav-import-secondary"
                  onClick={() => navigate('/settings/import-data')}
                >
                  <AppIcon name="upload_file" className="runner-dashboard-side-link-icon" aria-hidden="true" />
                  <span className="runs-subnav-link-copy">{t('run_detail.subnav_import')}</span>
                </button>
              </div>
            )}
        </div>
      </nav>

      <div className="runner-shell-sidebar-footer runs-subnav-footer">
        <button
          type="button"
          className="runner-shell-workout-btn runner-dashboard-workout-btn runs-subnav-workout"
          onClick={() => navigate('/today-run')}
          aria-label={t('analysis.pred_open_today')}
        >
          <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
          <span className="runner-dashboard-workout-btn-label">{t('analysis.pred_open_today')}</span>
        </button>
      </div>
    </aside>
  );
}
