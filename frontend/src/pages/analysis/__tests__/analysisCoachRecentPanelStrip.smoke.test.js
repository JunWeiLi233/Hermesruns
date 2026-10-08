import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(join(here, "../../../styles/analysis-coach-bento.css"), 'utf8');
const source = readFileSync(join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const stripReset = styles.match(/#root \.analysis-coach-bento > section,\s*#root \.analysis-coach-bento__signal\s*\{[^}]*\}/)?.[0];
const titleReset = styles.match(/#root \.analysis-coach-bento :is\(\.analysis-coach-bento__phase, \.analysis-coach-bento__reasons, \.analysis-coach-bento__recent\) h3\s*\{[^}]*\}/)?.[0];

assert.ok(stripReset, 'Coach Insight recent panel should retain a route-scoped panel surface.');
assert.match(stripReset, /background:\s*var\(--bento-card\);/, 'Recent panel background should remain visible.');
assert.ok(titleReset, 'Coach Insight recent title should have a route-scoped strip reset.');
assert.doesNotMatch(titleReset, /(?:background|border|box-shadow)\s*:/, 'The recent title should retain plain heading styling without a panel strip.');
assert.match(stripReset, /box-shadow:\s*none;/, 'Recent panel should retain its unshadowed surface.');
assert.match(
  source,
  /<section className="analysis-coach-bento__recent">\s*<h3>\{t\('analysis\.coach_dashboard_recent_title'\)\}<\/h3>/,
  'Coach Insight should keep the recent-training title rendered.',
);

console.log('[PASS] Coach Insight recent title keeps its panel and removes only the title strip.');
