import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const recentSessionIcon = source.match(/analysis-coach-command-session-icon[\s\S]{0,420}/)?.[0];

assert.ok(recentSessionIcon, 'Coach Insight should render a recent-session icon wrapper.');
assert.match(
  recentSessionIcon,
  /<AppIcon name="load_balance_runner"/,
  'Coach Insight recent-session cards should use the shared solid runner icon.',
);
assert.doesNotMatch(
  recentSessionIcon,
  /<AppIcon name="directions_run"/,
  'Coach Insight recent-session cards should not use the old outlined runner icon.',
);

console.log('[PASS] Coach Insight recent-session cards use the shared solid runner icon.');
