import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const summaryStyle = readFileSync(path.join(srcRoot, 'styles/analysis-summary.css'), 'utf8');
const appStyle = readFileSync(path.join(srcRoot, 'styles/app.css'), 'utf8');
const brief = readFileSync(path.join(srcRoot, '../../docs/APPLE_HEALTH_REDESIGN_BRIEF.md'), 'utf8');

assert.match(appStyle, /@import '\.\/analysis-summary\.css';/);
assert.match(summaryStyle, /DV-2026-09-04-005/);
assert.match(summaryStyle, /--ahs-canvas:\s*#f2f2f7;/);
assert.match(summaryStyle, /Deference: quiet stage|Liquid Glass = nav layer|APPLE_HEALTH_REDESIGN_BRIEF/);
assert.match(summaryStyle, /Liquid Glass = nav layer|Glass chrome only/);
assert.match(summaryStyle, /No hover-lift carnival/);
assert.doesNotMatch(
  summaryStyle,
  /\.hd-today-card/,
  'Analysis summary styling must not override the Profile training card.',
);
assert.match(
  summaryStyle,
  /body #root \.runner-shell-page\.analysis-page-shell \.analysis-overview-card:is\(\s*\.analysis-profile-primary,\s*\.analysis-profile-reference-card\.is-trend\s*\)\s*\{[^}]*border:\s*0\s*!important;[^}]*border-radius:\s*16px\s*!important;[^}]*box-shadow:\s*none\s*!important;/,
  'The VO2 and fitness-change cards should match the borderless load-balance surface.',
);
assert.match(brief, /Health Summary card anatomy/);
assert.doesNotMatch(summaryStyle, /Sleep Score|Levothyroxine|Medications/);
console.log('[PASS] Research-backed Apple Health Summary contract passed.');
