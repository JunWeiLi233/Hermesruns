import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const appIconSource = readFileSync(path.join(here, "../../../components/AppIcon.jsx"), 'utf8');

assert.match(
  source,
  /function resolveLoadTrendDirection\(currentValue, previousValue\)/,
  'Load Balance should centralize trend direction classification.',
);
assert.match(
  source,
  /return currentNumber === previousNumber \? 'flat' : currentNumber > previousNumber \? 'up' : 'down';/,
  'Load Balance should classify unchanged, rising, and falling values explicitly.',
);
assert.match(
  source,
  /function resolveLoadTrendIcon\(direction\)[\s\S]*?direction === 'up' \? 'trending_up' : direction === 'down' \? 'trending_down' : 'horizontal_rule'/,
  'Load Balance should map trend direction to up, down, and dash icons.',
);
assert.match(
  source,
  /const previousRatio = previousChronicValue > 0 \? previousAcuteValue \/ previousChronicValue : acwr;/,
  'Load Balance should compare the current ACWR to the previous available ratio.',
);
assert.match(
  source,
  /ratioTrendIcon: resolveLoadTrendIcon\(ratioTrend\)/,
  'Load Balance should expose the computed trend icon to the ratio card.',
);
assert.match(
  source,
  /name=\{loadDashboard\.ratioTrendIcon\}/,
  'Load Balance ratio card should render the computed trend icon.',
);
assert.doesNotMatch(
  source,
  /name="change_history" className=\{cx\('runner-dashboard-side-link-icon', 'analysis-load-command-ratio-icon'\)\}/,
  'Load Balance ratio card should not keep the fixed triangle icon.',
);
assert.match(
  appIconSource,
  /case 'horizontal_rule':[\s\S]*?<path d="M5 12h14" \/>/,
  'AppIcon should provide a plain horizontal dash glyph for flat trends.',
);

console.log('[PASS] Load Balance trend icon guard passed.');
