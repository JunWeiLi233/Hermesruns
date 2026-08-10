import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, 'Analysis.jsx'), 'utf8');
const analysisStyleSource = readFileSync(path.join(here, '../styles/_split/analysis.css'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');

assert.match(
  analysisSource,
  /apiJson\('\/api\/v1\/weather\/context',\s*\{\s*signal:\s*controller\.signal\s*\}\)/,
  'Analysis should consume the existing heat-adaptation context endpoint with an abortable request.',
);

assert.match(
  analysisSource,
  /const \[weatherContext, setWeatherContext\] = useState\(null\);[\s\S]*const \[weatherContextState, setWeatherContextState\] = useState\('idle'\);/,
  'Analysis should track heat-adaptation data independently from the primary run-analysis request.',
);

assert.match(
  analysisSource,
  /const correctedRunCount = useMemo\(\(\) => runs\.filter\(\(run\) => Number\(run\?\.pacePenaltySecPerKm\) > 0\)\.length, \[runs\]\);/,
  'Analysis should explain how many historical runs already use per-run weather correction.',
);

assert.match(
  analysisSource,
  /<section[\s\S]*className=\{cx\('analysis-heat-context',[\s\S]*data-testid="analysis-heat-context"/,
  'Analysis should render a dedicated heat-adaptation interpretation section.',
);

for (const key of [
  'heat_baseline',
  'heat_current',
  'heat_delta',
  'heat_pace_adjustment',
  'heat_adaptation_day',
  'heat_penalty_factor',
]) {
  assert.match(
    analysisSource,
    new RegExp(`t\\('analysis\\.${key}'\\)`),
    `Analysis heat context should render ${key}.`,
  );
  assert.match(enSource, new RegExp(`"${key}"\\s*:`), `English analysis copy should define ${key}.`);
  assert.match(zhSource, new RegExp(`"${key}"\\s*:`), `Chinese analysis copy should define ${key}.`);
}

assert.match(
  analysisSource,
  /weatherContext\?\.available\s*\? formatHeatPenalty\(weatherContext\.pacePenaltySecPerKm, t\)\s*:\s*'--'/,
  'Unavailable heat context must not expose its placeholder zero as a real no-adjustment result.',
);

assert.match(
  analysisSource,
  /const snapshot = useMemo\(\(\) => buildAnalysisSnapshot\(runs, lang, unit\), \[runs, lang, unit\]\);/,
  'Today\'s weather context must not rewrite historical VDOT, zones, or prediction inputs.',
);

assert.match(
  analysisStyleSource,
  /\/\* Analysis heat-adaptation context \*\/[\s\S]*\.analysis-page-shell \.analysis-heat-context\s*\{[\s\S]*grid-template-columns:[\s\S]*\.analysis-page-shell \.analysis-heat-context__metrics\s*\{[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/,
  'Heat adaptation should use a compact desktop interpretation grid rather than an oversized duplicate Weather page card.',
);

assert.match(
  analysisStyleSource,
  /@media \(max-width: 760px\)[\s\S]*\.analysis-page-shell \.analysis-heat-context__metrics\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  'Heat adaptation metrics should remain scannable in two columns on mobile.',
);

console.log('Analysis heat-adaptation smoke test passed.');
