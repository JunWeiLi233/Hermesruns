import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');

assert.match(
  dashboardSource,
  /function getLocalizedCourseMapSummary\(preview, raceId, lang, t\)/,
  'Course-map summaries should pass through a locale-aware formatter before rendering.',
);
assert.match(
  dashboardSource,
  /courseMapLocalizedSummary = getLocalizedCourseMapSummary\(courseMapDisplayPreview, selectedCourseMapRaceId, lang, t\)/,
  'The extraction output should render the localized course-map summary.',
);
assert.match(
  zhSource,
  /"course_maps_summary_tokyo_official_2026": "Hermes 根据东京马拉松 2026 官方分段计时地标绘制了这条赛道/,
  'Chinese locale should include the Tokyo course-map summary translation.',
);
assert.match(
  enSource,
  /"course_maps_summary_tokyo_official_2026": "Hermes rendered this course from the official Tokyo Marathon 2026 passing-time landmarks/,
  'English locale should preserve the canonical Tokyo course-map summary.',
);

const localizedSummaryRules = [
  'amsterdam-marathon',
  'bergen-city-marathon',
  'los-angeles-marathon',
  'osaka-marathon',
  'athens-marathon',
  'boston-marathon',
  'wuxi-marathon',
  'chicago-marathon',
  'berlin-marathon',
  'new-york-city-marathon',
];

for (const raceId of localizedSummaryRules) {
  assert.match(
    dashboardSource,
    new RegExp(`raceId: '${raceId}'[\\s\\S]+?course_maps_summary_`),
    `Dashboard should provide an explicit localization rule for ${raceId}.`,
  );
}

for (const key of [
  'course_maps_summary_amsterdam_official',
  'course_maps_summary_bergen_official',
  'course_maps_summary_los_angeles_official',
  'course_maps_summary_osaka_official',
  'course_maps_summary_athens_official',
  'course_maps_summary_boston_official',
  'course_maps_summary_wuxi_official',
  'course_maps_summary_chicago_official',
  'course_maps_summary_berlin_official',
  'course_maps_summary_new_york_city_official',
  'course_maps_summary_checked_local_geometry',
  'course_maps_summary_landmark_corridor',
]) {
  assert.match(zhSource, new RegExp(`"${key}":`), `Chinese locale should include ${key}.`);
  assert.match(enSource, new RegExp(`"${key}":`), `English locale should include ${key}.`);
}

console.log('[PASS] Course-map summary localization guard passed.');
