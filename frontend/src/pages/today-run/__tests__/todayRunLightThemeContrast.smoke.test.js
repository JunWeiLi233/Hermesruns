import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, "../TodayRun.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/_split/today-run.css"), 'utf8');
const finalStyleSource = readFileSync(path.join(here, "../../../styles/all-pages-liquid-glass.css"), 'utf8');
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

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.today-run-command-page\s*\{[\s\S]*--ahs-pink:\s*#c6254b;[\s\S]*--ahs-blue:\s*#0066d6;[\s\S]*--ahs-green:\s*#207c38;[\s\S]*--ahs-orange:\s*#9c5300;[\s\S]*--ahs-teal:\s*#087184;/,
  'Today Run must shadow shared chart accents with text-safe light-theme variants.',
);

assert.match(
  styleSource,
  /\.today-run-readiness-signal-label\s*\{[\s\S]*font-size:\s*0\.75rem;[\s\S]*opacity:\s*1;/,
  'Readiness labels must remain readable at the compact card size.',
);

assert.match(
  styleSource,
  /#root \.today-run-command-page :is\([\s\S]*\.today-run-readiness-signal-scale[\s\S]*\)\s*\{[\s\S]*color:\s*#55504a !important;[\s\S]*opacity:\s*1;/,
  'Readiness labels, values, and scales must use solid high-contrast text in light themes.',
);

assert.match(
  styleSource,
  /#root \.today-run-command-page \.today-run-coaching-answer-delta\s*\{[\s\S]*color:\s*#1f7836 !important;/,
  'Positive VDOT deltas must use a text-safe green on white cards.',
);

assert.match(
  styleSource,
  /#root \.today-run-command-page \.today-run-command-hero \.today-run-plan-hero-metrics > article > span\s*\{\s*color:\s*#59544e !important;/,
  'Hero metric labels must remain readable on the light summary cards.',
);

assert.match(
  styleSource,
  /#root \.today-run-command-page \.today-run-plan-step-card > span\s*\{\s*color:\s*#8f3b30 !important;/,
  'Workout phase labels must use a text-safe ember color.',
);

assert.match(
  styleSource,
  /#root \.today-run-command-page \.today-run-shoe-brief-action\s*\{\s*color:\s*#7a332a !important;/,
  'The shoe action must remain readable on its light card.',
);

assert.equal(
  (pageSource.match(/role="meter"/g) || []).length,
  4,
  'Each readiness signal must expose meter semantics instead of labeling a generic span.',
);

for (const attribute of ['aria-valuemin={0}', 'aria-valuemax={100}', 'aria-valuenow={coachPayload.state.readiness']) {
  assert.equal(
    pageSource.split(attribute).length - 1,
    4,
    `Each readiness meter must include ${attribute}.`,
  );
}

console.log('[PASS] Today Run light-theme contrast guardrails passed.');
