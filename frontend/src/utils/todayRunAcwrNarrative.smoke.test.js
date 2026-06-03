import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const todayRunSource = readFileSync(path.join(here, '..', 'pages', 'TodayRun.jsx'), 'utf8');

assert.match(
  todayRunSource,
  /import \{ getTodayRunAcwrInsight \} from ['"]\.\.\/utils\/todayRunAcwrInsight['"]/,
  'TodayRun.jsx should import the ACWR coach-narrative helper from the dedicated insight module'
);

assert.match(
  todayRunSource,
  /today-run-coaching-answer--load is-acwr-\$\{acwrInsight\.zone\}/,
  'TodayRun.jsx should render the ACWR load block with the insight zone class'
);

assert.match(
  todayRunSource,
  /acwrNarrative\.stripLabel[\s\S]*acwrNarrative\.title[\s\S]*acwrNarrative\.body/,
  'TodayRun.jsx should render the translated ACWR strip, title, and body copy from the insight helper'
);

assert.match(
  todayRunSource,
  /getTodayRunAcwrInsight\(metrics\.acwr\)/,
  'TodayRun.jsx should build the ACWR coach-language narrative through the dedicated helper instead of inline branching'
);

assert.doesNotMatch(
  todayRunSource,
  /switch \(acwrState\.zone\)/,
  'TodayRun.jsx should no longer hardcode the ACWR narrative switch inline'
);

console.log('[PASS] TodayRun ACWR narrative smoke test passed.');
