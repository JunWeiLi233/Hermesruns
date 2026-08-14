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
  { key: 'half', route: '/prediction/half', icon: 'timer' },
  { key: 'marathon', route: '/prediction/marathon', icon: 'flag' },
];

function getPredictionLabel(key, lang) {
  const distance = RACE_DISTANCES.find((item) => item.key === key);
  if (!distance) return key;
  return lang === 'zh-CN' ? distance.labelZh : distance.labelEn;
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
  const navItems = [
    {
      key: 'analysis',
      route: '/analysis',
      label: t('profile.dashboard_nav_analysis'),
      icon: 'insights',
      active: !activeInsightKey && !activePredictionKey,
    },
    ...INSIGHT_ITEMS.map((item) => ({
      ...item,
      label: t(item.labelKey),
      active: item.key === activeInsightKey,
    })),
    ...PREDICTION_ITEMS.map((item) => ({
      ...item,
      label: getPredictionLabel(item.key, lang),
      active: item.key === activePredictionKey,
    })),
  ];

  return (
    <aside className="runner-shell-sidebar">
      <div className="runner-shell-brand runner-dashboard-brand">
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
          <span className="runner-dashboard-toggle-glyph" aria-hidden="true">
            {collapsed ? '>' : '<'}
          </span>
        </button>
      </div>

      <nav className="runner-shell-side-nav" aria-label={t('analysis.subnav_aria_label')}>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
            onClick={() => navigate(item.route)}
            aria-current={item.active ? 'page' : undefined}
            aria-label={item.label}
          >
            <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
            <span className="runner-dashboard-side-link-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="runner-shell-sidebar-footer">
        <button
          type="button"
          className="runner-shell-workout-btn runner-dashboard-workout-btn"
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
