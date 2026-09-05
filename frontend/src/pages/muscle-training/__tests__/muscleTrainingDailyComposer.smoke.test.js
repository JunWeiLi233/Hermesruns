import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, "../MuscleTraining.jsx"), 'utf8');
const graphSource = readFileSync(path.join(here, "../../../components/RunActivityContributionGraph.jsx"), 'utf8');
const cssSource = readFileSync(path.join(here, "../../../styles/_split/muscle-training.css"), 'utf8');
const enSource = readFileSync(path.join(here, "../../../i18n/locales/en/components.js"), 'utf8');
const zhSource = readFileSync(path.join(here, "../../../i18n/locales/zh-CN/components.js"), 'utf8');

assert.match(
  pageSource,
  /apiJson\('\/api\/training\/muscle\/check-ins'\)[\s\S]*?setMuscleCheckIns\(checkIns \|\| \[\]\)[\s\S]*?setMuscleActivityState/,
  'Muscle Training should load persisted muscle check-ins without blocking the plan request.',
);

assert.match(
  pageSource,
  /className="strength-plan-control-deck muscle-activity-deck"[\s\S]*?<RunActivityContributionGraph[\s\S]*?runs=\{muscleCheckIns\}[\s\S]*?status=\{muscleActivityState\}[\s\S]*?activityType="muscle"/,
  'The old two-column control deck should be replaced by the reusable activity graph.',
);

assert.match(
  graphSource,
  /action = null[\s\S]*?st-activity-head-actions[\s\S]*?\{action\}/,
  'The activity graph should expose an optional header action without changing Settings callers.',
);

assert.match(
  pageSource,
  /className="muscle-activity-checkin-btn"[\s\S]*?onClick=\{handleDailyCheckIn\}/,
  'The activity surface should expose a dedicated daily check-in action.',
);

assert.match(
  pageSource,
  /entryState: 'ACTUAL'[\s\S]*?distanceKm: null[\s\S]*?durationMinutes: null/,
  'Quick check-in should record actual completion without copying planned run metrics into actual fields.',
);

assert.match(
  pageSource,
  /const \[nextPlan, nextCheckIns\] = await Promise\.all\([\s\S]*?apiJson\('\/api\/training\/muscle\/check-ins'\)[\s\S]*?setMuscleCheckIns\(nextCheckIns\)/,
  'A successful check-in should refresh the map history so today appears without a full page reload.',
);

assert.match(
  pageSource,
  /plan\.todayCheckIn\?\.entryState === 'ACTUAL'/,
  'The daily check-in action should become unavailable after today is recorded.',
);

assert.doesNotMatch(pageSource, /muscle-controls-grid|muscle-profile-panel|mt-strength-composer/);
assert.doesNotMatch(pageSource, /apiJson\('\/api\/activities'\)/);
assert.match(cssSource, /\.muscle-activity-checkin-btn\s*\{/);

for (const [locale, source] of [['en', enSource], ['zh-CN', zhSource]]) {
  assert.match(source, /"check_in_done"/, `${locale} should include the completed daily check-in label.`);
}

console.log('[PASS] Muscle Training activity check-in guardrails passed.');
