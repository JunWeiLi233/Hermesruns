import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const injuryChart = source.match(
  /<div className="analysis-cinematic-chart" style=\{\{ position: 'relative' \}\}>[\s\S]*?onPointerMove=\{handleInjuryPointerMove\}[\s\S]*?<\/svg>/,
);

assert.ok(injuryChart, 'The Injury Risk chart markup should remain addressable.');
assert.match(
  injuryChart[0],
  /preserveAspectRatio="xMidYMid meet"/,
  'Injury Risk chart should preserve SVG geometry so circular markers do not stretch into ovals.',
);
assert.match(
  injuryChart[0],
  /r="6"\s+className="analysis-cinematic-scrubber-dot"/,
  'Injury Risk hover dot should use the same compact radius as Load Balance.',
);
assert.doesNotMatch(
  injuryChart[0],
  /r="7"\s+className="analysis-cinematic-scrubber-dot"/,
  'Injury Risk should not retain the oversized hover dot.',
);

console.log('[PASS] Injury-risk graph point geometry guard passed.');
