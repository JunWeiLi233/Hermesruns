export function getRunnerShellNavItems({ t, lang, activeKey = null }) {
  // Lang is preserved in the signature for backward-compat callers; copy now flows
  // exclusively through t() so the i18n parity check covers every nav item.
  void lang;

  return [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'territory', label: t('profile.dashboard_nav_territory'), route: '/territory', icon: 'territory' },
    { key: 'weather_engine', label: t('profile.dashboard_nav_weather_engine'), route: '/weather', icon: 'thermostat' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
    { key: 'muscle', label: t('muscle_training.nav_label'), route: '/muscle-training', icon: 'fitness_center' },
    { key: 'workflows', label: t('profile.dashboard_nav_workflows'), route: '/workflows', icon: 'account_tree' },
  ].map((item) => ({
    ...item,
    active: item.key === activeKey,
  }));
}
