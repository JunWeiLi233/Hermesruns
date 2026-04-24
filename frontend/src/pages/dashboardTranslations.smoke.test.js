import assert from 'node:assert/strict';
import translations from '../i18n/translations.js';

const dashboardZh = translations['zh-CN']?.dashboard;
const dashboardEn = translations.en?.dashboard;

assert.ok(dashboardZh, 'zh-CN dashboard translations should exist.');
assert.ok(dashboardEn, 'en dashboard translations should exist.');

const requiredKeys = [
  'brand_mark',
  'role_admin',
  'role_user',
  'tier_free',
  'tier_pro',
  'course_maps_title',
  'course_maps_intro',
  'course_maps_workspace_copy',
  'course_maps_upload',
  'course_maps_drop_hint',
  'course_maps_actions_hint',
  'course_maps_file_type_error',
  'course_maps_status_running_upload',
  'course_maps_status_running_refresh',
  'course_maps_refreshing_preview',
  'review_pending_summary_fallback',
  'catalog_lang_zh',
  'catalog_lang_en',
];

for (const key of requiredKeys) {
  assert.equal(typeof dashboardZh[key], 'string', `dashboard zh-CN key "${key}" should exist.`);
  assert.equal(typeof dashboardEn[key], 'string', `dashboard en key "${key}" should exist.`);
  assert.notEqual(dashboardZh[key].trim(), '', `dashboard zh-CN key "${key}" should not be blank.`);
  assert.notEqual(dashboardEn[key].trim(), '', `dashboard en key "${key}" should not be blank.`);
  assert.doesNotMatch(
    dashboardZh[key],
    /\?{2,}/,
    `dashboard zh-CN key "${key}" should never degrade into question marks.`
  );
}

assert.doesNotMatch(
  dashboardEn.course_maps_intro,
  /scan official sources/i,
  'Dashboard course-map intro should no longer describe official-source scanning.',
);

assert.doesNotMatch(
  dashboardEn.course_maps_actions_hint,
  /\bscan\b/i,
  'Dashboard course-map action hint should no longer mention scan-based discovery.',
);

assert.match(
  dashboardEn.course_maps_action_group_source_hint,
  /upload/i,
  'Dashboard source hint should now anchor the workflow on upload.',
);

console.log('[PASS] Dashboard translation smoke test passed.');
