import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, '../../..', relativePath), 'utf8');
const insightSource = read('pages/analysis/AnalysisInsightDetail.jsx');
const appIconSource = read('components/AppIcon.jsx');

const intensityCard = insightSource.match(/<button type="button" className="analysis-cinematic-card analysis-cinematic-card--metric analysis-cinematic-card--interactive" onClick=\{\(\) => navigate\('\/analysis\/intensity'\)\}>[\s\S]*?<\/button>/)?.[0];
assert.ok(intensityCard, 'Injury Risk should render the intensity metric card.');
assert.match(
  intensityCard,
  /<AppIcon name="intensity_distribution"/,
  'The Injury Risk intensity card should use a distribution glyph instead of the generic architecture triangle.',
);
assert.doesNotMatch(
  intensityCard,
  /<AppIcon name="architecture"/,
  'The Injury Risk intensity card should not use the generic architecture triangle.',
);

const distributionCase = appIconSource.match(/case 'intensity_distribution':[\s\S]*?case 'boot':/)?.[0];
assert.ok(distributionCase, 'AppIcon should define the dedicated intensity distribution glyph.');
assert.match(distributionCase, /M4 19\.5h16/, 'The intensity distribution glyph should have a shared baseline.');
assert.match(distributionCase, /M6\.5 19v-5/, 'The intensity distribution glyph should show a low bar.');
assert.match(distributionCase, /M12 19V9/, 'The intensity distribution glyph should show a medium bar.');
assert.match(distributionCase, /M17\.5 19V5/, 'The intensity distribution glyph should show a high bar.');

console.log('[PASS] Injury Risk uses the dedicated intensity distribution icon.');
