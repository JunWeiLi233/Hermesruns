import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(join(here, "../../../styles/analysis-profile-visual-alignment.css"), 'utf8');
const source = readFileSync(join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const selector = 'body #root .analysis-insight-detail-page.is-coach-insight .analysis-profile-v2--coach .analysis-coach-command-recent-card';
const stripReset = styles.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')} \\{[\\s\\S]*?\\n\\}`))?.[0];
const titleReset = styles.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')} \\.analysis-coach-command-panel-head \\{[\\s\\S]*?\\n\\}`))?.[0];

assert.ok(stripReset, 'Coach Insight recent panel should retain a route-scoped panel surface.');
assert.match(stripReset, /background:\s*var\(--analysis-v2-card\)\s*!important;/, 'Recent panel background should remain visible.');
assert.ok(titleReset, 'Coach Insight recent title should have a route-scoped strip reset.');
assert.match(titleReset, /background:\s*transparent\s*!important;/, 'Recent title strip background should be transparent.');
assert.match(titleReset, /box-shadow:\s*none\s*!important;/, 'Recent title strip shadow should be removed.');
assert.match(
  source,
  /analysis-coach-command-recent-card[\s\S]*?t\('analysis\.coach_dashboard_recent_title'\)/,
  'Coach Insight should keep the recent-training title rendered.',
);

console.log('[PASS] Coach Insight recent title keeps its panel and removes only the title strip.');
