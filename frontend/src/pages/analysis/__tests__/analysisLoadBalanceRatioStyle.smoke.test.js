import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const styles = readFileSync(join(here, "../../../styles/_split/analysis.css"), 'utf8');
const routeStyles = readFileSync(join(here, "../../../styles/analysis-load-balance-profile-alignment.css"), 'utf8');
const generatedStyles = readFileSync(join(here, "../../../styles/style.generated.css"), 'utf8');
const ratioRule = styles.match(/\.analysis-load-command-ratio-value strong\s*\{[^}]*\}/s)?.[0];
const routeRatioRule = routeStyles.match(/\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-ratio-value strong\s*\{[^}]*\}/s)?.[0];
const generatedRouteRatioRule = generatedStyles.match(/\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-ratio-value strong\s*\{[^}]*\}/s)?.[0];

assert.ok(ratioRule, 'Load Balance ACWR ratio value should have a dedicated style rule.');
assert.match(
  ratioRule,
  /font-style:\s*normal\s*;/,
  'Load Balance ACWR ratio value should render upright instead of italic.',
);
assert.doesNotMatch(
  ratioRule,
  /font-style:\s*italic\s*;/,
  'Load Balance ACWR ratio value should not retain italic styling.',
);

assert.ok(routeRatioRule, 'Load Balance route should have a dedicated ACWR ratio value rule.');
assert.match(
  routeRatioRule,
  /font-style:\s*normal\s*;/,
  'Load Balance route ACWR ratio value should override its route-specific italic styling.',
);
assert.doesNotMatch(
  routeRatioRule,
  /font-style:\s*italic\s*;/,
  'Load Balance route ACWR ratio value should not remain italic after route overrides apply.',
);

assert.ok(generatedRouteRatioRule, 'Generated runtime CSS should include the Load Balance ACWR route rule.');
assert.match(
  generatedRouteRatioRule,
  /font-style:\s*normal\s*;/,
  'Generated runtime CSS should keep the Load Balance ACWR ratio value upright.',
);
assert.doesNotMatch(
  generatedRouteRatioRule,
  /font-style:\s*italic\s*;/,
  'Generated runtime CSS should not reintroduce italic ACWR typography.',
);

assert.match(
  detailSource,
  /name=\{loadDashboard\.ratioTrendIcon\} className=\{cx\('runner-dashboard-side-link-icon', 'analysis-load-command-ratio-icon'\)\}/,
  'Load Balance ACWR ratio should use the computed trend icon with its dedicated class.',
);
const ratioIconRule = routeStyles.match(/\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-ratio-value \.analysis-load-command-ratio-icon\s*\{[^}]*\}/s)?.[0];
assert.ok(ratioIconRule, 'Load Balance ACWR ratio trend icon should have a route-specific sizing rule.');
assert.match(ratioIconRule, /width:\s*26px\s*;/, 'ACWR trend icon should render larger at 26px wide.');
assert.match(ratioIconRule, /height:\s*26px\s*;/, 'ACWR trend icon should render larger at 26px high.');
assert.match(ratioIconRule, /margin-left:\s*6px\s*;/, 'ACWR trend icon should sit slightly farther to the right.');

console.log('[PASS] Load Balance ACWR ratio value typography guard passed.');
