import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const heatmap = fs.readFileSync(path.join(srcRoot, 'pages/heatmap/Heatmap.jsx'), 'utf8');
const cache = fs.readFileSync(path.join(srcRoot, 'api/resourceCache.ts'), 'utf8');
const analysis = fs.readFileSync(path.join(srcRoot, 'pages/analysis/Analysis.jsx'), 'utf8');
const importModal = fs.readFileSync(path.join(srcRoot, 'components/ImportActivityModal.jsx'), 'utf8');

const fullIdx = heatmap.indexOf('const HEATMAP_FULL_RENDER_POINT_LIMIT = 12000');
assert.match(heatmap, /const HEATMAP_SAMPLE_LIMIT = 12000/);
assert.doesNotMatch(heatmap, /HEATMAP_SAMPLE_LIMIT = 25000/);
assert.ok(fullIdx >= 0);
assert.match(cache, /ACTIVITIES_TTL_MS = 120 \* 1000/);
assert.match(analysis, /cachedApiJson\('\/api\/activities\/analysis'\)/);
// Initial load and the shared import callback reuse one cached loader. The
// modal invalidates activity resources before handing control back to it.
assert.match(importModal, /invalidateResourceCache\('\/api\/activities'\);\s*onClose\?\.\(\);\s*onImported\?\.\(\);/);
assert.match(analysis, /<ImportActivityModal[\s\S]*?onImported=\{loadAnalysisData\}/);
assert.equal((analysis.match(/cachedApiJson\('\/api\/activities\/analysis'\)/g) || []).length, 1);
assert.doesNotMatch(analysis, /apiJson\('\/api\/activities\/analysis'\)/);
console.log('frontendMemoryFootprint.smoke.test.js OK');
