import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const todayRunSource = readFileSync(path.join(here, 'todayRun.js'), 'utf8');
const sharedSource = readFileSync(path.join(here, 'personalizedCoachPlan.js'), 'utf8');

assert.match(
  sharedSource,
  /intent: today.intent \|\| 'base'/,
  'Every surface should preserve the shared coach intent, including comeback.',
);

assert.doesNotMatch(
  todayRunSource,
  /hasGapInLast3|daysSinceLastRun >= 2/,
  'A page must not independently replace the server prescription with a comeback session.',
);

console.log('[PASS] todayRun comeback intent coverage passed.');
