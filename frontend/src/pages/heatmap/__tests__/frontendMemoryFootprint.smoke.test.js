import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const heatmap = fs.readFileSync(path.join(srcRoot, 'pages/heatmap/Heatmap.jsx'), 'utf8');
const cache = fs.readFileSync(path.join(srcRoot, 'api/resourceCache.ts'), 'utf8');
const analysis = fs.readFileSync(path.join(srcRoot, 'pages/analysis/Analysis.jsx'), 'utf8');

const fullIdx = heatmap.indexOf('const HEATMAP_FULL_RENDER_POINT_LIMIT = 12000');
const sampleIdx = heatmap.indexOf('const HEATMAP_SAMPLE_LIMIT = HEATMAP_FULL_RENDER_POINT_LIMIT');
assert.ok(fullIdx >= 0 && sampleIdx > fullIdx, 'FULL_RENDER must be declared before SAMPLE_LIMIT');
assert.doesNotMatch(heatmap, /HEATMAP_SAMPLE_LIMIT = 25000/);
assert.match(cache, /ACTIVITIES_TTL_MS = 120 \* 1000/);
assert.match(analysis, /cachedApiJson\('\/api\/activities\/analysis'\)/);
assert.match(analysis, /apiJson\('\/api\/activities\/analysis'\)/);
assert.match(analysis, /invalidateResourceCache\('\/api\/activities'\)/);
// initial load keeps cache; post-import refresh must invalidate + apiJson
assert.equal((analysis.match(/cachedApiJson\('\/api\/activities\/analysis'\)/g) || []).length, 1);
assert.equal((analysis.match(/apiJson\('\/api\/activities\/analysis'\)/g) || []).length, 1);
console.log('frontendMemoryFootprint.smoke.test.js OK');
