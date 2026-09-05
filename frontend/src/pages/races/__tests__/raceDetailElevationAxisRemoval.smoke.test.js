import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, "../RacesDetail.jsx"), 'utf8');
const racesStyleSource = readFileSync(path.join(here, "../../../styles/_split/races.css"), 'utf8');
const lightThemeSource = readFileSync(path.join(here, "../../../styles/_split/light-theme-overrides.css"), 'utf8');
const englishSource = readFileSync(path.join(here, "../../../i18n/locales/en/pages.js"), 'utf8');
const chineseSource = readFileSync(path.join(here, "../../../i18n/locales/zh-CN/pages.js"), 'utf8');

assert.doesNotMatch(pageSource, /race-detail-course-axis|detail_course_axis_(?:start|half|finish)/);
assert.doesNotMatch(racesStyleSource, /\.race-detail-course-axis\s*\{/);
assert.doesNotMatch(lightThemeSource, /race-detail-course-axis/);
assert.doesNotMatch(englishSource, /detail_course_axis_(?:start|half|finish)/);
assert.doesNotMatch(chineseSource, /detail_course_axis_(?:start|half|finish)/);

assert.match(pageSource, /className="race-detail-elevation-svg"/);
assert.match(pageSource, /onPointerMove=\{handleElevationPointerMove\}/);

console.log('[PASS] Race detail elevation axis removal guardrails passed.');
