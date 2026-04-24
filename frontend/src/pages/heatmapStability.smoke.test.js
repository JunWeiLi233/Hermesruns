import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const heatmapSource = readFileSync(path.join(here, 'Heatmap.jsx'), 'utf8');

assert.match(
  heatmapSource,
  /const points = useMemo\([\s\S]*?normalizePointSpeedRatios\(Array\.isArray\(heatmap\?\.points\) \? heatmap\.points : \[\]\)[\s\S]*?\[heatmap\?\.points\][\s\S]*?\);/,
  'Heatmap should memoize its normalized GPS point collection so viewport updates do not rebuild the map instance and cause flashing.',
);

assert.match(
  heatmapSource,
  /}, \[bounds, heatmapState, points\]\);/,
  'Heatmap map-mount effect should depend on the memoized points collection rather than a fresh array built every render.',
);

console.log('[PASS] Heatmap stability regression guardrails passed.');
