import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const page = read('../PredictionDetail.jsx');
const appStyles = read('../../../styles/app.css');
const selection = read('../../../utils/predictionSelection.ts');
const predictionStyles = read('../../../styles/prediction-v2.css');
const contentRule = predictionStyles.match(/#root \.prediction-v2 \{([^}]+)\}/)?.[1] || '';

assert.match(contentRule, /max-width:\s*none;/,
  'Prediction grids should use the available page width rather than large centered gutters.');
assert.match(contentRule, /padding:\s*28px clamp\(20px, 2vw, 32px\) 48px;/,
  'Desktop outer gutters should stay compact while retaining the existing vertical spacing.');
assert.match(predictionStyles, /@media \(max-width: 640px\)\s*\{\s*#root \.prediction-v2 \{ padding: 24px 16px 32px; gap: 16px; \}/,
  'Mobile gutters and spacing must remain unchanged.');
assert.match(predictionStyles, /#root \.prediction-v2-top \{[^}]*gap: 20px;/,
  'Reducing outer margins must not change the gap between the two forecast cards.');

assert.ok(appStyles.includes("@import './prediction-v2.css';"), 'The handoff stylesheet must be included in the app bundle.');
assert.match(page, /fetchActivitySummaries\(\)/, 'Forecasts must keep using the activity summary API.');
assert.match(page, /predictRaceTimeCalibrated\(adjustedVdot, distance\.meters, runs, \{ weatherAdjustedAnchors: true \}\)/,
  'The weather-adjusted forecast must preserve correction of calibration anchors.');
assert.match(selection, /adjustedVdot - input\.representativeVdot > 0\.05/,
  'The existing meaningful-weather-correction guard must stay in place.');
assert.match(page, /const hasWeatherTrend = trendPredictions\.some\(/,
  'The chart must avoid an overlapping duplicate weather series.');
assert.match(page, /<Line data=\{chartData\} options=\{chartOptions\}/, 'The existing live trend chart must stay connected.');

console.log('[PASS] Prediction handoff retains its forecast data and weather model.');
