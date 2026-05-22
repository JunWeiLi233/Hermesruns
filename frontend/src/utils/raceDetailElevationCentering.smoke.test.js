import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, '../pages/RacesDetail.jsx'), 'utf8');

assert.match(
  racesDetailSource,
  /const centerChartViewport = \(\) => \{/,
  'RacesDetail should define a dedicated helper that centers the elevation chart viewport.',
);

assert.match(
  racesDetailSource,
  /requestAnimationFrame\(\(\) => requestAnimationFrame\(centerChartViewport\)\)/,
  'RacesDetail should run a double requestAnimationFrame centering pass so the elevation chart scroll position is applied after layout settles.',
);

assert.match(
  racesDetailSource,
  /setTimeout\(centerChartViewport,\s*1\d{2}\)/,
  'RacesDetail should keep a delayed centering retry so the elevation chart does not reopen at 0 km when the stage finishes sizing late.',
);

console.log('[PASS] Race detail elevation centering guardrails passed.');
