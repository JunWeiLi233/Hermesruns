export const TAB_ITEMS = [
  { key: 'overview', labelKey: 'dashboard.tab_overview' },
  { key: 'users', labelKey: 'dashboard.tab_users' },
  { key: 'courseMaps', labelKey: 'dashboard.tab_course_maps' },
  { key: 'shoes', labelKey: 'dashboard.tab_shoes' },
  { key: 'jobs', labelKey: 'dashboard.tab_jobs' },
  { key: 'audit', labelKey: 'dashboard.tab_audit' },
  { key: 'settings', labelKey: 'dashboard.tab_settings' },
];

export const TAB_ITEM_MAP = Object.fromEntries(TAB_ITEMS.map((tab) => [tab.key, tab]));

export const TAB_ICONS = {
  overview: 'dashboard',
  users: 'groups',
  courseMaps: 'map',
  shoes: 'footprint',
  jobs: 'sync',
  audit: 'history',
  settings: 'settings',
};

export const TAB_ROUTE_MAP = {
  overview: '/dashboard',
  users: '/dashboard/users',
  courseMaps: '/dashboard/course-maps',
  shoes: '/dashboard/shoes',
  jobs: '/dashboard/jobs',
  audit: '/dashboard/audit',
  settings: '/dashboard/settings',
};

export function normalizeDashboardPathname(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '');
  return normalized || '/dashboard';
}

export function getDashboardSectionFromPathname(pathname) {
  const normalized = normalizeDashboardPathname(pathname);
  const match = Object.entries(TAB_ROUTE_MAP).find(([, route]) => route === normalized);
  return match ? match[0] : null;
}
