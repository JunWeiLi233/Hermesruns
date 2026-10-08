import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const styles = readFileSync(path.join(here, "../../../styles/analysis-profile-visual-alignment.css"), 'utf8');

assert.match(
  source,
  /analysis-injury-v2-chart/,
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
console.log('[PASS] Injury-risk graph parity guard passed.');
