import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const pageSource = read('pages/PredictionDetail.jsx');
const indexSource = read('index.css');
const skeletonSource = read('components/PageSkeleton.jsx');
const skeletonStyleSource = read('styles/loading-skeleton.css');
const predictionSelectionSource = read('utils/predictionSelection.ts');
const stylePath = path.join(srcRoot, 'styles/prediction-profile-alignment.css');

assert.ok(existsSync(stylePath), 'The prediction route needs a dedicated Profile-alignment stylesheet.');
const styleSource = read('styles/prediction-profile-alignment.css');

for (const marker of [
  'prediction-profile-content',
  'prediction-profile-metric-strip',
  'prediction-profile-training-grid',
  'prediction-weather-card',
  'prediction-weather-comparison',
]) {
  assert.ok(pageSource.includes(marker), `PredictionDetail is missing the ${marker} hierarchy marker.`);
}

assert.match(
  pageSource,
  /const adjustedVdot = currentVdot\.adjustedVdot \|\| representativeVdot;/,
  'Prediction detail should expose the weather-adjusted current VDOT.',
);
assert.match(
  `${pageSource}\n${predictionSelectionSource}`,
  /selectRacePrediction[\s\S]*adjustedVdot - input\.representativeVdot > 0\.05[\s\S]*forecastVdot: useWeatherAdjusted \? input\.adjustedVdot : input\.representativeVdot/,
  'Prediction detail should use adjusted VDOT only when a meaningful correction exists.',
);
assert.match(
  pageSource,
  /predictRaceTimeCalibrated\(adjustedVdot, distance\.meters, runs, \{ weatherAdjustedAnchors: true \}\)/,
  'Weather-adjusted race forecasts should also correct recent calibration anchors.',
);
assert.match(
  pageSource,
  /const hasWeatherTrend = trendPredictions\.some\(/,
  'Prediction history should distinguish a real weather correction from an overlapping duplicate series.',
);

const glassImport = indexSource.indexOf("@import './styles/all-pages-liquid-glass.css';");
const predictionImport = indexSource.indexOf("@import './styles/prediction-profile-alignment.css';");
assert.ok(predictionImport > glassImport, 'Prediction Profile alignment must load after the shared glass cascade.');

assert.match(styleSource, /\.prediction-detail-page \.prediction-profile-content\s*\{[\s\S]*--prediction-profile-radius-xl:\s*20px/);
assert.match(styleSource, /\.prediction-detail-page \.prediction-profile-metric-strip\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
assert.match(styleSource, /\.prediction-detail-page \.prediction-profile-training-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.45fr\)\s+minmax\(280px,\s*0\.75fr\)/);
assert.match(styleSource, /\.prediction-detail-page \.prediction-weather-card\s*\{/);
assert.match(styleSource, /\.prediction-detail-page \.prediction-weather-comparison\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(styleSource, /body:is\([^)]*\.theme-midnight[^)]*\)[\s\S]*\.prediction-profile-content/);

const baseHeroIndex = styleSource.indexOf('.prediction-detail-page .prediction-forecast-hero {');
const lightHeroIndex = styleSource.indexOf(
  'body:is(.theme-light, .theme-high-contrast-light) .prediction-detail-page .prediction-forecast-hero {',
);
assert.ok(baseHeroIndex >= 0, 'Prediction detail needs a base forecast hero treatment.');
assert.ok(
  lightHeroIndex > baseHeroIndex,
  'The light theme must override the base dark forecast hero after the Profile stylesheet loads.',
);
assert.match(
  styleSource.slice(lightHeroIndex, lightHeroIndex + 900),
  /#fffdf9/,
  'The light-theme forecast hero should use a white Profile surface instead of the dark grid.',
);
const baseCoachIndex = styleSource.indexOf('.prediction-detail-page .prediction-coach-rail {');
const lightCoachIndex = styleSource.indexOf(
  'body:is(.theme-light, .theme-high-contrast-light) .prediction-detail-page .prediction-coach-rail {',
);
assert.ok(baseCoachIndex >= 0, 'Prediction detail needs a coach advice rail treatment.');
assert.ok(
  lightCoachIndex > baseCoachIndex,
  'The light theme must override the dark coach advice rail after the Profile stylesheet loads.',
);
assert.match(
  styleSource.slice(baseCoachIndex, lightCoachIndex),
  /background:[\s\S]*#fffdf9/,
  'The coach advice rail should default to the white Profile surface instead of a dark gradient.',
);
assert.match(
  styleSource.slice(lightCoachIndex, lightCoachIndex + 900),
  /#fffdf9/,
  'The light-theme coach advice rail should use a white Profile surface instead of the dark grid.',
);
assert.match(styleSource, /:focus-visible/);
assert.match(styleSource, /@media \(max-width:\s*1080px\)/);
assert.match(styleSource, /@media \(max-width:\s*560px\)/);
assert.match(styleSource, /@media \(prefers-reduced-motion:\s*reduce\)/);

for (const marker of [
  'page-skeleton__prediction-profile-metrics',
  'page-skeleton__prediction-profile-training',
]) {
  assert.ok(skeletonSource.includes(marker), `Prediction skeleton is missing ${marker}.`);
  assert.ok(skeletonStyleSource.includes(`.${marker}`), `Prediction skeleton styles are missing ${marker}.`);
}

assert.match(
  skeletonStyleSource,
  /@media \(max-width:\s*1080px\)\s*\{[\s\S]*?\.page-skeleton__prediction-command\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  'Prediction skeleton hero should collapse with the loaded hero at 1080px.',
);

console.log('[PASS] Prediction detail uses the compact Profile design hierarchy.');
