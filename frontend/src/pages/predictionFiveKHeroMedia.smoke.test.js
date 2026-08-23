import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'PredictionDetail.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '..', 'styles', 'prediction-profile-alignment.css'), 'utf8');
const assetPath = path.join(here, '..', 'assets', 'generated', 'prediction-5k-hero.png');

assert.ok(existsSync(assetPath), 'The 5K prediction hero needs its supplied street-running image asset.');
assert.match(
  pageSource,
  /predictionFiveKHeroImage/,
  'The prediction detail page should import the supplied 5K hero image.',
);
assert.match(
  pageSource,
  /distance\?\.key === '5k'[\s\S]*?prediction-forecast-hero-media[\s\S]*?predictionFiveKHeroImage/,
  'The supplied image should render only in the 5K hero right-side media slot.',
);
assert.match(
  pageSource,
  /className="prediction-forecast-hero-media"[\s\S]*?alt=""/,
  'The decorative hero image should have an empty alt attribute.',
);
assert.match(
  styleSource,
  /\.prediction-detail-page \.prediction-forecast-hero\.is-five-k\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.35fr\)\s+minmax\(250px,\s*0\.52fr\)[\s\S]*?padding-right:\s*0/,
  'The 5K hero should restore the narrower right-side media column without right padding.',
);
assert.match(
  styleSource,
  /\.prediction-detail-page \.prediction-forecast-hero-media\s*\{[\s\S]*?margin-block:\s*calc\(-1\s*\*\s*var\(--prediction-forecast-hero-pad\)\)/,
  'The 5K hero image should use the hero edge space instead of keeping vertical padding around it.',
);

console.log('[PASS] 5K prediction hero uses the supplied right-side image.');
