import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const page = read('../PredictionDetail.jsx');
const appStyles = read('../../../styles/app.css');
const selection = read('../../../utils/predictionSelection.ts');

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
