import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, '../../..', relativePath), 'utf8');

const insightSource = read('pages/analysis/AnalysisInsightDetail.jsx');
const styleSource = read('styles/analysis-load-balance-profile-alignment.css');

assert.match(
  insightSource,
  /import loadBalanceTrack from '\.\.\/\.\.\/assets\/generated\/load-balance-track\.webp';/,
  'Load Balance must import the supplied track image as a bundled asset.',
);
assert.match(
  insightSource,
  /className="analysis-load-profile-visual" aria-hidden="true"[\s\S]*<img src=\{loadBalanceTrack\} alt=""(?:\s+[^>]*)?\/>/,
  'The Load Balance hero must render the track image as a decorative visual layer.',
);
assert.match(
  styleSource,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-visual\s*\{/,
  'Load Balance must own the hero visual layer styling.',
);
assert.match(
  styleSource,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-visual img\s*\{/,
  'The supplied track image must be cropped and treated as a hero image.',
);

const loadDecisionTextRule = styleSource.match(
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-decision :is\(\s*\.coach-identity-copy strong,\s*h2,\s*\.analysis-load-profile-window strong\s*\)\s*\{([\s\S]*?)\}/,
);
assert.ok(loadDecisionTextRule, 'Load Balance coach decision text must have an explicit readability rule.');
assert.match(
  loadDecisionTextRule[1],
  /color:\s*#fff8f1\s*!important;/,
  'Load Balance coach identity and decision title must remain white on the dark focus card.',
);

const lightLoadCoachTextRule = styleSource.match(
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-decision \.coach-identity-copy strong\s*\{([\s\S]*?)\}/,
);
assert.ok(lightLoadCoachTextRule, 'Load Balance light-theme coach identity text must have an explicit readability rule.');
assert.match(
  lightLoadCoachTextRule[1],
  /color:\s*#fff8f1\s*!important;/,
  'Load Balance coach identity must stay white when the dark focus card is rendered in the light theme.',
);

const loadDecisionTitleCascadeRule = styleSource.match(
  /body #root \.analysis-insight-detail-page\.is-load-balance \.analysis-load-profile-decision h2\s*\{([\s\S]*?)\}/,
);
assert.ok(
  loadDecisionTitleCascadeRule,
  'Load Balance decision title must have a high-specificity route rule.',
);
assert.match(
  loadDecisionTitleCascadeRule[1],
  /color:\s*#fff8f1\s*!important;/,
  'Load Balance decision title must win over shared Profile heading styles.',
);

console.log('[PASS] Load Balance hero media guardrails passed.');
