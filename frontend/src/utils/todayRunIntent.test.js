import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const todayRunSource = readFileSync(path.join(here, 'todayRun.js'), 'utf8');

assert.match(
  todayRunSource,
  /} else if \(hasGapInLast3 && bestVdot > 0\) \{[\s\S]*intent:\s*'comeback'/,
  'Missed-session comeback recommendations should expose the comeback intent for downstream UI decisions.',
);

assert.match(
  todayRunSource,
  /} else if \(daysSinceLastRun !== null && daysSinceLastRun >= 2\) \{[\s\S]*intent:\s*'comeback'/,
  'Comeback recommendations should expose a stable internal intent for downstream UI decisions.',
);

console.log('[PASS] todayRun comeback intent coverage passed.');
