import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const todayRunSource = readFileSync(path.join(here, "../pages/today-run/TodayRun.jsx"), 'utf8');

assert.match(
  todayRunSource,
  /import \{ getTodayRunAcwrInsight \} from ['"]\.\.\/\.\.\/utils\/todayRunAcwrInsight['"]/,
  'TodayRun.jsx should import the ACWR coach-narrative helper from the dedicated insight module'
);

assert.match(
  todayRunSource,
  /tr-v2-card tr-v2-metric is-acwr-\$\{acwrInsight\.zone\}/,
  'TodayRun.jsx should render the ACWR load block with the insight zone class'
);

assert.match(
  todayRunSource,
  /acwrNarrative\.stripLabel[\s\S]*acwrNarrative\.title[\s\S]*acwrNarrative\.body/,
  'TodayRun.jsx should render the translated ACWR strip, title, and body copy from the insight helper'
);

assert.match(
  todayRunSource,
  /getTodayRunAcwrInsight\(metrics\.acwr,\s*metrics\.coachLoadEvidence\)/,
  'TodayRun.jsx should give the dedicated ACWR narrative helper both the effort ratio and personalized planner basis'
);

assert.match(
  todayRunSource,
  /\[metrics\.acwr,\s*metrics\.coachLoadEvidence\]/,
  'TodayRun.jsx should refresh the ACWR narrative when either metric value or planner evidence changes'
);

assert.doesNotMatch(
  todayRunSource,
  /switch \(acwrState\.zone\)/,
  'TodayRun.jsx should no longer hardcode the ACWR narrative switch inline'
);

console.log('[PASS] TodayRun ACWR narrative smoke test passed.');
