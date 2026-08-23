import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const settingsSource = readFileSync(path.join(here, 'Settings.jsx'), 'utf8');
const layoutSource = readFileSync(path.join(here, '..', 'components', 'SettingsAtlasLayout.jsx'), 'utf8');
const graphSource = readFileSync(path.join(here, '..', 'components', 'RunActivityContributionGraph.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '..', 'styles', '_split', 'settings.css'), 'utf8');
const englishSource = readFileSync(path.join(here, '..', 'i18n', 'locales', 'en', 'pages.js'), 'utf8');
const chineseSource = readFileSync(path.join(here, '..', 'i18n', 'locales', 'zh-CN', 'pages.js'), 'utf8');

assert.match(
  settingsSource,
  /apiJson\('\/api\/activities', \{ signal: settingsController\.signal \}\)[\s\S]*?setRunActivities[\s\S]*?setRunActivityState/,
  'Settings should fetch run activity with its existing bounded request lifecycle.',
);

assert.match(
  settingsSource,
  /<SettingsAtlasLayout[\s\S]*?runActivities=\{runActivities\}[\s\S]*?runActivityState=\{runActivityState\}/,
  'Settings should pass the fetched activity state into the atlas layout.',
);

assert.match(
  layoutSource,
  /<section className="st-hero">[\s\S]*?<\/section>[\s\S]*?<RunActivityContributionGraph[\s\S]*?runs=\{runActivities\}[\s\S]*?status=\{runActivityState\}/,
  'The activity graph should sit directly below the Settings profile hero.',
);

assert.match(
  graphSource,
  /buildRunActivityCalendar[\s\S]*?role="img"[\s\S]*?st-activity-weeks[\s\S]*?st-activity-legend/,
  'The graph should use the calendar model, expose one accessible graphic, and render a contribution legend.',
);

assert.match(
  graphSource,
  /formatDistance\(tooltip\.day\.distanceKm,\s*1,\s*lang(?:,\s*unit)?\)/,
  'Hovering a contribution cell should include that day\'s formatted run distance.',
);

assert.match(
  styleSource,
  /\.st-activity-graph\s*\{[\s\S]*?background:[\s\S]*?#fff[\s\S]*?border:/,
  'The run activity graph should be a white Settings surface in the default theme.',
);

assert.match(
  styleSource,
  /\.st-activity-grid-frame\s*\{[\s\S]*?overflow-x:\s*auto;/,
  'The graph should remain usable on narrow screens through contained horizontal scrolling.',
);

assert.match(
  graphSource,
  /st-activity-calendar"\s*style=\{\{\s*'--st-activity-week-count':\s*calendar\.weeks\.length\s*\}\}/,
  'The graph should expose its week count to the fluid calendar layout.',
);

assert.doesNotMatch(
  graphSource,
  /gridTemplateColumns:\s*`repeat\(\$\{calendar\.weeks\.length\}, 11px\)`/,
  'Month labels should not lock the activity graph to fixed-width week tracks.',
);

assert.match(
  styleSource,
  /\.st-activity-grid-inner\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*100%;/,
  'The activity grid should claim the available card width on desktop.',
);

assert.match(
  styleSource,
  /\.st-activity-weeks\s*\{[\s\S]*?grid-template-columns:\s*repeat\(var\(--st-activity-week-count\),\s*minmax\(11px,\s*1fr\)\);/,
  'Every week should flex to fill the graph while retaining an 11px minimum cell width.',
);

for (const source of [englishSource, chineseSource]) {
  assert.match(source, /"stitch_activity_title"/, 'Both locales should provide the graph title.');
  assert.match(source, /"stitch_activity_empty"/, 'Both locales should provide the zero-run state.');
  assert.match(source, /"stitch_activity_day_label":\s*"[^"\r\n]*\{distance\}/, 'Both locales should include daily distance in the cell hover label.');
}

console.log('[PASS] Settings run activity graph guardrails passed.');
