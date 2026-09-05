import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, "../PredictionDetail.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/prediction-profile-alignment.css"), 'utf8');
const assetPath = path.join(here, "../../../assets/generated/prediction-half-hero.webp");

assert.ok(existsSync(assetPath), 'The half-marathon prediction hero needs the supplied Valencia 21K image asset.');
assert.match(
  pageSource,
  /predictionHalfHeroImage/,
  'The prediction detail page should import the supplied half-marathon hero image.',
);
assert.match(
  pageSource,
  /distance\?\.key === 'half'[\s\S]*?prediction-forecast-hero-media[\s\S]*?predictionHalfHeroImage/,
  'The supplied image should render in the half-marathon hero right-side media slot.',
);
assert.match(
  styleSource,
  /\.prediction-detail-page \.prediction-forecast-hero\.is-half\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.35fr\)\s+minmax\(250px,\s*0\.52fr\)[\s\S]*?padding-right:\s*0/,
  'The half-marathon hero should use the same right-side media column as the 5K and 10K heroes.',
);

console.log('[PASS] Half-marathon prediction hero uses the supplied right-side image.');
