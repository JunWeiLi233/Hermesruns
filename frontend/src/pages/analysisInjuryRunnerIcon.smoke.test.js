import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const injurySampleIcon = source.match(/analysis-cinematic-sample-icon[\s\S]{0,320}/)?.[0];

assert.ok(injurySampleIcon, 'Injury Risk should render a recent-run sample icon wrapper.');
assert.match(
  injurySampleIcon,
  /<AppIcon name="load_balance_runner"/,
  'Injury Risk recent-run cards should use the dedicated Load Balance runner icon.',
);
assert.doesNotMatch(
  injurySampleIcon,
  /<AppIcon name="directions_run"/,
  'Injury Risk recent-run cards should not fall back to the old outlined runner icon.',
);

console.log('[PASS] Injury Risk uses the dedicated Load Balance runner icon.');
