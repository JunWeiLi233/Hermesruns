import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const recentSection = source.match(/<section className="analysis-coach-bento__recent">[\s\S]*?<\/section>/)?.[0];
const recentSessionMarker = recentSection?.match(/<i className=\{cx\('analysis-coach-bento__zone',[^\n]*\/>/)?.[0];

assert.ok(recentSessionMarker, 'Coach Insight should render a recent-session zone marker.');
assert.match(
  recentSessionMarker,
  /`is-\$\{row\.zoneKey\}`\)\} aria-hidden="true"/,
  'Coach Insight recent-session markers should reflect the run zone without adding an accessible icon label.',
);
assert.doesNotMatch(
  recentSection,
  /<AppIcon name="directions_run"/,
  'Coach Insight recent-session cards should not use the old outlined runner icon.',
);

for (const binding of ['row.title', 'row.dateLabel', 'row.distanceLabel', 'row.loadScore']) {
  assert.ok(recentSection.includes(binding), `Recent sessions should preserve ${binding} beside their zone marker.`);
}
assert.match(recentSection, /disabled=\{!row\.id\}/, 'Recent sessions without an ID should remain disabled.');
assert.match(recentSection, /row\.id && navigate\(buildRunDetailPath\(row\.id\)\)/, 'Recent sessions should still open the matching run.');
const styles = readFileSync(join(here, "../../../styles/analysis-coach-bento.css"), 'utf8');
assert.match(styles, /#root \.analysis-coach-bento__zone\s*\{[^}]*width:\s*8px;[^}]*height:\s*8px;[^}]*background:\s*var\(--bento-easy\);/, 'Recent sessions should retain visible zone markers.');
assert.match(styles, /\.analysis-coach-bento__zone:is\(\.is-marathon\)\s*\{[^}]*background:\s*var\(--bento-moderate\);/, 'Marathon sessions should retain their moderate zone color.');
assert.match(styles, /\.analysis-coach-bento__zone:is\(\.is-threshold, \.is-interval, \.is-rep\)\s*\{[^}]*background:\s*var\(--bento-hard\);/, 'Hard sessions should retain their hard zone color.');

console.log('[PASS] Coach Insight recent-session rows preserve zone markers, data, and run navigation.');
