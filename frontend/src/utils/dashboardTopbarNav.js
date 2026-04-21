const DASHBOARD_TOPBAR_LABEL_KEYS = {
  overview: 'dashboard.tab_overview',
  users: 'dashboard.tab_users',
  courseMaps: 'dashboard.tab_course_maps',
  shoes: 'dashboard.tab_shoes',
  jobs: 'dashboard.tab_jobs',
  audit: 'dashboard.tab_audit',
  settings: 'dashboard.tab_settings',
};

export function getDashboardTopbarTabKeys(activeTab) {
  if (!DASHBOARD_TOPBAR_LABEL_KEYS[activeTab] || activeTab === 'overview') {
    return ['overview'];
  }

  return ['overview', activeTab];
}

export function getDashboardTopbarLabelKeys(activeTab) {
  return getDashboardTopbarTabKeys(activeTab).map((tabKey) => DASHBOARD_TOPBAR_LABEL_KEYS[tabKey]);
}
