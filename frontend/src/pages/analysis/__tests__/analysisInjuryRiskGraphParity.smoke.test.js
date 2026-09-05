import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const styles = readFileSync(path.join(here, "../../../styles/analysis-profile-visual-alignment.css"), 'utf8');

assert.match(
  source,
  /analysis-injury-profile-chart-card/,
  'Injury Risk should expose a route-specific chart card for Load Balance visual parity.',
);
assert.match(
  source,
  /analysis-injury-chart-tooltip-head/,
  'Injury Risk tooltip should use the same structured header as the Load Balance tooltip.',
);
assert.match(
  source,
  /analysis-injury-chart-tooltip-metric is-primary/,
  'Injury Risk tooltip should expose its primary load value as a colored metric row.',
);
assert.match(
  source,
  /analysis-injury-chart-tooltip-metric is-muted/,
  'Injury Risk tooltip should expose its comparison value as a colored metric row.',
);
const tooltipHeadStart = source.indexOf('<div className="analysis-injury-chart-tooltip-head">');
const tooltipHeadEnd = source.indexOf('</div>', tooltipHeadStart);
assert.ok(tooltipHeadStart >= 0 && tooltipHeadEnd > tooltipHeadStart, 'Injury Risk tooltip header should remain addressable.');
assert.doesNotMatch(
  source.slice(tooltipHeadStart, tooltipHeadEnd),
  /<i aria-hidden="true" \/>/,
  'Injury Risk tooltip header should not render the decorative red marker.',
);
assert.doesNotMatch(
  styles,
  /\.analysis-profile-v2--injury \.analysis-injury-chart-tooltip-head > i\s*\{/,
  'Injury Risk tooltip should not retain a decorative red-marker rule.',
);
assert.match(
  styles,
  /\.analysis-profile-v2--injury \.analysis-injury-profile-chart-card\s*\{[\s\S]*?min-height:\s*340px;[\s\S]*?background:\s*var\(--analysis-v2-card\) !important;/,
  'Injury Risk chart card should use the same light, dimensional surface as Load Balance.',
);
assert.match(
  styles,
  /\.analysis-profile-v2--injury \.analysis-injury-profile-chart-card \.analysis-cinematic-comparison-line\s*\{[\s\S]*?stroke:\s*#78b4ff;[\s\S]*?stroke-dasharray:\s*5 3;/,
  'Injury Risk comparison series should use the same blue dashed treatment as Load Balance.',
);
assert.match(
  styles,
  /\.analysis-profile-v2--injury \.analysis-injury-profile-chart-card \.analysis-cinematic-point\s*\{[\s\S]*?display:\s*none;/,
  'Injury Risk should use the Load Balance chart treatment without static point clutter.',
);
assert.match(
  source,
  /const leftPct = Math\.min\(80, Math\.max\(10,/,
  'Injury Risk tooltip should keep its horizontal anchor inside the graph bounds.',
);
assert.match(
  source,
  /const topPct = Math\.min\(56, Math\.max\(10,/,
  'Injury Risk tooltip should keep its vertical anchor inside the graph bounds.',
);
assert.match(
  styles,
  /\.analysis-profile-v2--injury \.analysis-injury-profile-chart-card \.analysis-injury-chart-tooltip\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?max-width:\s*calc\(100% - 24px\);[\s\S]*?transform:\s*none;/,
  'Injury Risk tooltip should be contained by the graph instead of inheriting the legacy lift transform.',
);
assert.match(
  styles,
  /@media\s*\(max-width:\s*760px\)[\s\S]*?\.analysis-profile-v2--injury \.analysis-injury-profile-chart-card \.analysis-injury-chart-tooltip\s*\{[\s\S]*?left:\s*12px !important;[\s\S]*?right:\s*12px !important;/,
  'Injury Risk tooltip should use the full available graph width on small screens.',
);

console.log('[PASS] Injury-risk graph parity guard passed.');
