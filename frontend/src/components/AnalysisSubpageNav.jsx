import AppIcon from './AppIcon';
import HermesLogo from './HermesLogo';
import { RACE_DISTANCES } from '../utils/vdot';

const INSIGHT_ITEMS = [
  { key: 'load-balance', route: '/analysis/load-balance', labelKey: 'analysis.load_detail_title', icon: 'show_chart' },
  { key: 'intensity', route: '/analysis/intensity', labelKey: 'analysis.intensity_detail_title', icon: 'speed' },
  { key: 'injury-risk', route: '/analysis/injury-risk', labelKey: 'analysis.stitch_injury_title', icon: 'error' },
  { key: 'coach-insight', route: '/analysis/coach-insight', labelKey: 'analysis.coach_detail_title', icon: 'psychology' },
];

const PREDICTION_ITEMS = [
  { key: '5k', route: '/prediction/5k', icon: 'timer' },
  { key: '10k', route: '/prediction/10k', icon: 'timer' },
  { key: 'half', route: '/prediction/half', icon: 'distance' },
  { key: 'marathon', route: '/prediction/marathon', icon: 'flag' },
];

function getPredictionLabel(key, lang) {
  const distance = RACE_DISTANCES.find((item) => item.key === key);
  if (!distance) return key;
  return lang === 'zh-CN' ? distance.labelZh : distance.labelEn;
}

function AnalysisNavLink({ active, icon, index, label, onClick }) {
  return (
    <button
      type="button"
      className={`analysis-subnav-link${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={label}
    >
      <span className="analysis-subnav-link-icon" aria-hidden="true">
        <AppIcon name={icon} />
      </span>
      <span className="analysis-subnav-link-copy">{label}</span>
      <span className="analysis-subnav-link-index" aria-hidden="true">{index}</span>
    </button>
  );
}

export default function AnalysisSubpageNav({
  activeInsightKey,
  activePredictionKey,
  collapsed,
  lang,
  navigate,
  onToggle,
  t,
}) {
  const insightItems = INSIGHT_ITEMS.map((item) => ({ ...item, label: t(item.labelKey) }));
  const predictionItems = PREDICTION_ITEMS.map((item) => ({
    ...item,
    label: getPredictionLabel(item.key, lang),
  }));
  const activeItem = insightItems.find((item) => item.key === activeInsightKey)
    || predictionItems.find((item) => item.key === activePredictionKey)
    || { label: t('profile.dashboard_nav_analysis'), icon: 'insights' };

  return (
    <aside className="runner-shell-sidebar analysis-subnav">
      <div className="runner-shell-brand runner-dashboard-brand analysis-subnav-header">
        <div className="runner-dashboard-brand-copy">
          <HermesLogo dark />
          <span>{t('analysis.subnav_title')}</span>
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

      <div className="analysis-subnav-current" aria-live="polite">
        <span className="analysis-subnav-current-icon" aria-hidden="true">
          <AppIcon name={activeItem.icon} />
        </span>
        <span>
          <small>{t('analysis.subnav_current')}</small>
          <strong>{activeItem.label}</strong>
        </span>
      </div>

      <nav className="analysis-subnav-nav" aria-label={t('analysis.subnav_aria_label')}>
        <AnalysisNavLink
          active={false}
          icon="insights"
          index="00"
          label={t('profile.dashboard_nav_analysis')}
          onClick={() => navigate('/analysis')}
        />

        <div className="analysis-subnav-group">
          <span className="analysis-subnav-group-label">{t('analysis.subnav_insights')}</span>
          {insightItems.map((item, index) => (
            <AnalysisNavLink
              key={item.key}
              active={item.key === activeInsightKey}
              icon={item.icon}
              index={String(index + 1).padStart(2, '0')}
              label={item.label}
              onClick={() => navigate(item.route)}
            />
          ))}
        </div>

        <div className="analysis-subnav-group">
          <span className="analysis-subnav-group-label">{t('analysis.subnav_predictions')}</span>
          {predictionItems.map((item, index) => (
            <AnalysisNavLink
              key={item.key}
              active={item.key === activePredictionKey}
              icon={item.icon}
              index={`R${index + 1}`}
              label={item.label}
              onClick={() => navigate(item.route)}
            />
          ))}
        </div>
      </nav>

      <div className="runner-shell-sidebar-footer analysis-subnav-footer">
        <button type="button" className="analysis-subnav-today" onClick={() => navigate('/today-run')}>
          <AppIcon name="directions_run" aria-hidden="true" />
          <span>{t('analysis.pred_open_today')}</span>
        </button>
      </div>
    </aside>
  );
}
