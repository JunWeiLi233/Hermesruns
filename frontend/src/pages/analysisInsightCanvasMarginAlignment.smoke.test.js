import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const detailRedesignSource = readFileSync(
  path.join(here, '../styles/analysis-detail-redesigns.css'),
  'utf8',
);
const predictionProfileAlignmentSource = readFileSync(
  path.join(here, '../styles/prediction-profile-alignment.css'),
  'utf8',
);
const profileVisualAlignmentSource = readFileSync(
  path.join(here, '../styles/analysis-profile-visual-alignment.css'),
  'utf8',
);

const intensityCanvasRule = detailRedesignSource.match(
  /body \.analysis-insight-detail-page\.is-intensity \.runner-shell-canvas\.analysis-insight-detail-canvas\s*\{[^}]*\}/s,
);
assert.ok(intensityCanvasRule, 'The canonical /analysis/intensity canvas rule must exist.');
assert.match(
  intensityCanvasRule[0],
  /\bmargin:\s*0\s*;/,
  'The canonical /analysis/intensity canvas rule must use margin: 0.',
);

const sharedLateAlignmentRule = profileVisualAlignmentSource.match(
  /body #root \.analysis-insight-detail-page:is\(\.is-injury-risk, \.is-coach-insight, \.is-load-balance\) \.runner-shell-canvas\.analysis-insight-detail-canvas\s*\{[^}]*\}/s,
);
assert.ok(
  sharedLateAlignmentRule,
  'The shared late alignment canvas rule for injury risk, coach insight, and load balance must exist.',
);
assert.match(
  sharedLateAlignmentRule[0],
  /\bmargin:\s*0\s*!important\s*;/,
  'The shared late alignment canvas rule must use margin: 0 !important.',
);
assert.doesNotMatch(
  sharedLateAlignmentRule[0],
  /\bmargin:\s*0\s+0\s+0\s+16px\s*!important\s*;/,
  'The shared late alignment canvas rule must not retain the old left-offset margin.',
);

const predictionCanvasRule = predictionProfileAlignmentSource.match(
  /\.prediction-detail-page \.runner-shell-canvas\s*\{[^}]*\}/s,
);
assert.ok(predictionCanvasRule, 'The /prediction/5k canvas alignment rule must exist.');
assert.match(
  predictionCanvasRule[0],
  /\bwidth:\s*100%\s*!important\s*;[\s\S]*\bmax-width:\s*none\s*!important\s*;[\s\S]*\bmargin:\s*0\s*!important\s*;[\s\S]*\bpadding:\s*0\s*!important\s*;/,
  'The final /prediction/5k canvas rule must remain the alignment reference.',
);

const loadBalanceCanvasRule = profileVisualAlignmentSource.match(
  /body #root \.analysis-insight-detail-page\.is-load-balance \.runner-shell-canvas\.analysis-insight-detail-canvas\s*\{[^}]*\}/s,
);
assert.ok(
  loadBalanceCanvasRule,
  'The /analysis/load-balance canvas must have a dedicated prediction-aligned override.',
);
assert.match(
  loadBalanceCanvasRule[0],
  /\bwidth:\s*100%\s*!important\s*;[\s\S]*\bmax-width:\s*none\s*!important\s*;[\s\S]*\bmargin:\s*0\s*!important\s*;[\s\S]*\bpadding-inline:\s*clamp\(16px,\s*2\.5vw,\s*40px\)\s*!important\s*;/,
  'The /analysis/load-balance canvas must keep the same responsive horizontal gutter as the final /prediction/5k layout.',
);

const loadBalanceProfileRule = profileVisualAlignmentSource.match(
  /body #root \.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile\s*\{[^}]*\}/s,
);
assert.ok(
  loadBalanceProfileRule,
  'The /analysis/load-balance profile wrapper must have a dedicated prediction-aligned override.',
);
assert.match(
  loadBalanceProfileRule[0],
  /\bwidth:\s*min\(100%\s*-\s*32px,\s*1480px\)\s*!important\s*;[\s\S]*\bmax-width:\s*1480px\s*!important\s*;[\s\S]*\bmargin:\s*0\s+auto\s*!important\s*;[\s\S]*\bpadding:\s*28px\s+clamp\(20px,\s*3vw,\s*48px\)\s+60px\s*!important\s*;/,
  'The /analysis/load-balance profile wrapper must use the same centered max-width and horizontal padding as /prediction/5k.',
);

const alignedInsightCanvasRule = profileVisualAlignmentSource.match(
  /body #root \.analysis-insight-detail-page:is\(\.is-injury-risk, \.is-coach-insight\) \.runner-shell-canvas\.analysis-insight-detail-canvas\s*\{[^}]*\}/s,
);
assert.ok(
  alignedInsightCanvasRule,
  'Injury Risk and Coach Insight must have a shared prediction-aligned canvas override.',
);
assert.match(
  alignedInsightCanvasRule[0],
  /\bwidth:\s*100%\s*!important\s*;[\s\S]*\bmax-width:\s*none\s*!important\s*;[\s\S]*\bmargin:\s*0\s*!important\s*;[\s\S]*\bpadding-inline:\s*clamp\(16px,\s*2\.5vw,\s*40px\)\s*!important\s*;/,
  'Injury Risk and Coach Insight must keep the same responsive horizontal canvas gutter as the reference pages.',
);

const alignedProfileRule = profileVisualAlignmentSource.match(
  /body #root \.analysis-insight-detail-page\.is-injury-risk \.analysis-profile-v2--injury,\s*body #root \.analysis-insight-detail-page\.is-coach-insight \.analysis-profile-v2--coach\s*\{[^}]*\}/s,
);
assert.ok(
  alignedProfileRule,
  'Injury Risk and Coach Insight must have shared prediction-aligned profile wrappers.',
);
assert.match(
  alignedProfileRule[0],
  /\bwidth:\s*min\(100%\s*-\s*32px,\s*1480px\)\s*!important\s*;[\s\S]*\bmax-width:\s*1480px\s*!important\s*;[\s\S]*\bmargin:\s*0\s+auto\s*!important\s*;[\s\S]*\bpadding:\s*28px\s+clamp\(20px,\s*3vw,\s*48px\)\s+60px\s*!important\s*;/,
  'Injury Risk and Coach Insight must use the same centered max-width and horizontal padding as /prediction/5k.',
);

console.log('[PASS] Analysis insight canvas margin alignment guardrails passed.');
