import assert from 'node:assert/strict';
import {
  getDashboardTopbarTabKeys,
  getDashboardTopbarLabelKeys,
} from './dashboardTopbarNav.js';

assert.deepEqual(
  getDashboardTopbarTabKeys('overview'),
  ['overview'],
  'Overview should only expose the dashboard tab in the admin topbar.',
);

assert.deepEqual(
  getDashboardTopbarTabKeys('users'),
  ['overview', 'users'],
  'Users should expose Dashboard plus the current Users tab in the admin topbar.',
);

assert.deepEqual(
  getDashboardTopbarTabKeys('courseMaps'),
  ['overview', 'courseMaps'],
  'Course maps should expose Dashboard plus the current Course Maps tab in the admin topbar.',
);

assert.deepEqual(
  getDashboardTopbarLabelKeys('users'),
  ['dashboard.tab_overview', 'dashboard.tab_users'],
  'Users should keep the dashboard-first label order in the admin topbar.',
);

assert.deepEqual(
  getDashboardTopbarLabelKeys('settings'),
  ['dashboard.tab_overview', 'dashboard.tab_settings'],
  'Settings should expose Dashboard plus the current Settings tab in the admin topbar.',
);

console.log('[PASS] Dashboard topbar route contract passed.');
