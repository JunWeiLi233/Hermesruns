import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runDetailSource = readFileSync(path.join(here, "../RunDetail.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/run-detail-profile-minimal.css"), 'utf8');

assert.match(
  runDetailSource,
  /className="run-detail-link-btn run-detail-warning-action"/,
  'The elevation warning should use a dedicated action hook for its redesigned button.',
);

assert.match(
  runDetailSource,
  /t\('run_detail\.recalibrate'\)/,
  'The elevation warning should keep its existing conditional recalibration action and copy.',
);

assert.match(
  runDetailSource,
  /apiFetch\(`\/api\/activities\/\$\{run\.id\}\/elevation\/recalibrate`/,
  'The elevation warning redesign must preserve the recalibration endpoint.',
);

assert.match(
  styleSource,
  /\.run-detail-profile-minimal \.run-detail-warning\s*\{[\s\S]*?background:\s*var\(--run-detail-card-soft\)\s*!important;/,
  'The elevation warning should use the neutral Run Detail card surface.',
);

assert.match(
  styleSource,
  /\.run-detail-profile-minimal \.run-detail-warning::before\s*\{[\s\S]*?background:\s*var\(--run-detail-accent\);/,
  'The elevation warning should use a narrow accent rail instead of a full pink strip.',
);

assert.match(
  styleSource,
  /\.run-detail-profile-minimal \.run-detail-warning-action(?:,\s*\.run-detail-profile-minimal \.run-detail-splits-section \.run-detail-section-head > \.run-detail-link-btn)?\s*\{[\s\S]*?min-height:\s*42px;[\s\S]*?padding:\s*10px 17px;[\s\S]*?min-width:\s*104px;[\s\S]*?white-space:\s*nowrap;/,
  'The recalibration action should always retain readable internal spacing.',
);

assert.match(
  styleSource,
  /@media \(max-width: 720px\)[\s\S]*?\.run-detail-profile-minimal \.run-detail-warning\s*\{[\s\S]*?flex-direction:\s*column;/,
  'The elevation warning should stack on narrow screens instead of squeezing the action.',
);

console.log('[PASS] Run Detail elevation warning guardrails passed.');
