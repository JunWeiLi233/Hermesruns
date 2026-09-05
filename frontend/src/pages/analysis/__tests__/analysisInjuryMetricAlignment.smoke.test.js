import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const alignmentSource = readFileSync(
  path.join(here, "../../../styles/analysis-profile-visual-alignment.css"),
  'utf8',
);

const metricRule = alignmentSource.match(
  /\.analysis-profile-v2--injury \.analysis-cinematic-card--metric\s*\{([\s\S]*?)\}/,
);

assert.ok(metricRule, 'Injury Risk metric cards must keep a dedicated alignment rule.');
assert.match(
  metricRule[1],
  /align-items:\s*flex-start;/,
  'Injury Risk metric cards must start their icon and copy at the same vertical level.',
);

console.log('[PASS] Injury Risk metric alignment guardrails passed.');
