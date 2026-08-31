import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const profileAlignmentSource = fs.readFileSync(
  path.join(currentDir, '../styles/muscle-training-profile-alignment.css'),
  'utf8',
);

const resetIndex = profileAlignmentSource.lastIndexOf(
  '#root .runner-dashboard-page[data-muscle-theme]:has(.mt-top-workbench) .mt-video-card .mt-card-head,',
);
assert.ok(resetIndex >= 0, 'The video card heading should have a route-scoped nested-surface reset.');
assert.match(
  profileAlignmentSource.slice(resetIndex, resetIndex + 520),
  /\.mt-video-card \.mt-card-title\s*\{[\s\S]*border:\s*0 !important;[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*box-shadow:\s*none !important;/,
  'The video card heading and title should stay on the parent card surface instead of rendering a panel strip.',
);

const exerciseHeadingResetIndex = profileAlignmentSource.lastIndexOf(
  '#root .runner-dashboard-page[data-muscle-theme]:has(.mt-top-workbench) .mt-exercises-head .mt-card-title {',
);
assert.ok(
  exerciseHeadingResetIndex >= 0,
  'The exercise workspace title should have a route-scoped nested-surface reset.',
);
assert.match(
  profileAlignmentSource.slice(exerciseHeadingResetIndex, exerciseHeadingResetIndex + 400),
  /border:\s*0 !important;[\s\S]*background:\s*transparent !important;[\s\S]*background-image:\s*none !important;[\s\S]*box-shadow:\s*none !important;/,
  'The exercise workspace title should stay on the page surface instead of rendering a panel strip.',
);

console.log('[PASS] Muscle Training heading panel-strip guardrails passed.');
