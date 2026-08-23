import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/_split/today-run.css'), 'utf8');
const finalStyleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');
const lightThemeStart = styleSource.lastIndexOf('body:is(.theme-light, .theme-high-contrast-light) .today-run-command-page .today-run-command-hero {');

assert.ok(lightThemeStart >= 0, 'Today Run must have a final light-theme command-hero override.');
const lightThemeBlock = styleSource.slice(lightThemeStart);

assert.match(
  lightThemeBlock,
  /--tr-command-ink:\s*var\(--runner-profile-ink, #211f1a\) !important;[\s\S]*--tr-command-soft:\s*rgba\(33, 31, 26, 0\.76\) !important;[\s\S]*--tr-command-muted:\s*rgba\(33, 31, 26, 0\.58\) !important;/,
  'Today Run light-theme command tokens must remain dark enough for the paper surface.',
);

assert.match(
  finalStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.today-run-command-page \.today-run-command-hero :is\([\s\S]*\.today-run-marathon-pill,[\s\S]*\.today-run-plan-rationale-item[\s\S]*color:\s*#211f1a !important;/,
  'Today Run light-theme pills and rationale items must use black text in the final cascade layer.',
);

assert.match(
  finalStyleSource,
  /\.today-run-plan-morning-briefing p,[\s\S]*\.today-run-plan-wellness-insight span\s*\)[\s\S]*color:\s*#211f1a !important;/,
  'Today Run light-theme briefing copy must use black text in the final cascade layer.',
);

assert.match(
  finalStyleSource,
  /\.today-run-command-hero :where\([\s\S]*h1,[\s\S]*p,[\s\S]*span,[\s\S]*button,[\s\S]*color:\s*#211f1a !important;/,
  'Today Run light-theme text elements must share the black ink color.',
);

assert.match(
  finalStyleSource,
  /\.today-run-command-hero \.today-run-marathon-pill\s*\{[\s\S]*border:\s*0 !important;[\s\S]*background:\s*#f1f1f1 !important;/,
  'Today Run light-theme distance pills must use a borderless light-grey surface.',
);

assert.match(
  lightThemeBlock,
  /\.today-run-plan-morning-briefing p,[\s\S]*\.today-run-plan-wellness-insight span\s*\)[\s\S]*color:\s*var\(--tr-command-soft\) !important;/,
  'Today Run light-theme briefing copy must not inherit the dark-deck white text.',
);

assert.match(
  lightThemeBlock,
  /\.info-disclosure-trigger\s*\{[\s\S]*color:\s*var\(--runner-profile-ink, #211f1a\);/,
  'Today Run light-theme disclosure trigger must remain visible on the paper card.',
);

console.log('[PASS] Today Run light-theme contrast guardrails passed.');
