import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, '../styles/_split/analysis.css'), 'utf8');
const kickerSelectors = [
  '.analysis-page-shell .analysis-profile-reference-card.is-coach .analysis-overview-card-kicker',
  '.analysis-page-shell .analysis-profile-reference-card.is-trend .analysis-overview-card-kicker',
];
const kickerRuleStart = styles.lastIndexOf(`${kickerSelectors[0]},\n${kickerSelectors[1]} {`);

assert.ok(kickerRuleStart >= 0, 'Coach and VDOT kickers should share a route-specific surface rule');

const kickerRule = styles.slice(kickerRuleStart, styles.indexOf('}', kickerRuleStart) + 1);
for (const selector of kickerSelectors) {
  assert.match(kickerRule, /display:\s*inline\s*!important;/, `${selector} should render as plain inline text`);
  assert.match(kickerRule, /border:\s*0\s*!important;/, `${selector} should not render a badge border`);
  assert.match(kickerRule, /padding:\s*0\s*!important;/, `${selector} should not reserve badge padding`);
  assert.match(kickerRule, /background:\s*transparent\s*!important;/, `${selector} should not paint a red strip behind the text`);
}

assert.match(
  styles,
  /\.analysis-page-shell \.analysis-profile-reference-card\.is-coach \.analysis-overview-coach-copy,\s*\.analysis-page-shell \.analysis-profile-reference-card\.is-trend \.analysis-overview-card-head > div:first-child\s*\{[\s\S]*display:\s*grid;[\s\S]*align-content:\s*start;[\s\S]*gap:\s*0;/,
  'Coach and VDOT heading stacks should share the same top-aligned grid geometry',
);

assert.match(
  styles,
  /\.analysis-page-shell \.analysis-profile-reference-card\.is-trend\.is-empty\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\);/,
  'The empty VDOT trend card should provide a grid row for vertically centering its copy.',
);

assert.match(
  styles,
  /\.analysis-page-shell \.analysis-profile-reference-card\.is-trend\.is-empty \.analysis-overview-insight-copy\s*\{[^}]*align-self:\s*end;[^}]*text-align:\s*center;/,
  'The empty VDOT trend copy should align to the bottom with the neighboring coach card.',
);

console.log('[PASS] Analysis reference card alignment guardrail passed.');
