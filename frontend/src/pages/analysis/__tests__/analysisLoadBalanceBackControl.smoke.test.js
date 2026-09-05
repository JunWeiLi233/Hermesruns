import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const loadStart = source.indexOf("insightKey === 'load-balance' && loadDashboard ? (");
const loadEnd = source.indexOf(") : insightKey === 'intensity' && intensityDashboard ? (", loadStart);

assert.ok(loadStart >= 0 && loadEnd > loadStart, 'The load-balance detail branch should remain identifiable.');

assert.doesNotMatch(
  source.slice(loadStart, loadEnd),
  /analysis-load-profile-back|navigate\('\/analysis'\)/,
  'The load-balance detail page should not render the removed back-to-analysis control or handler.',
);

console.log('[PASS] Load Balance no longer renders the back-to-analysis control.');
