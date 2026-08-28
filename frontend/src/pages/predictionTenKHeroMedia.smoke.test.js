import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'PredictionDetail.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '..', 'styles', 'prediction-profile-alignment.css'), 'utf8');
const assetPath = path.join(here, '..', 'assets', 'generated', 'prediction-10k-hero.webp');

assert.ok(existsSync(assetPath), 'The 10K prediction hero needs its supplied Forbidden City running image asset.');
assert.match(
  pageSource,
  /predictionTenKHeroImage/,
  'The prediction detail page should import the supplied 10K hero image.',
);
assert.match(
  pageSource,
  /distance\?\.key === '10k'[\s\S]*?prediction-forecast-hero-media[\s\S]*?predictionTenKHeroImage/,
  'The supplied image should render only in the 10K hero right-side media slot.',
);
assert.match(
  pageSource,
  /className="prediction-forecast-hero-media"[\s\S]*?alt=""/,
  'The decorative 10K hero image should have an empty alt attribute.',
);
assert.match(
  styleSource,
  /\.prediction-detail-page \.prediction-forecast-hero\.is-ten-k\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.35fr\)\s+minmax\(250px,\s*0\.52fr\)[\s\S]*?padding-right:\s*0/,
  'The 10K hero should use the narrower right-side media column without right padding.',
);

console.log('[PASS] 10K prediction hero uses the supplied right-side image.');
