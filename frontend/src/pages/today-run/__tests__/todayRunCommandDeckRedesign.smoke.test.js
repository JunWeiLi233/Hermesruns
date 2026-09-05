import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, "../TodayRun.jsx"), 'utf8');
const styleSource = [
  readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8'),
  readFileSync(path.join(here, "../../../styles/_split/today-run.css"), 'utf8'),
].join('\n');
const liquidGlassSource = readFileSync(path.join(here, "../../../styles/all-pages-liquid-glass.css"), 'utf8');
const contrastSource = readFileSync(path.join(here, "../../../styles/contrast-fixes.css"), 'utf8');

assert.match(
  pageSource,
  /today-run-plan-page today-run-command-page/,
  'Today Run should expose the command-page class used by the redesigned command deck.',
);

assert.match(
  pageSource,
  /today-run-plan-hero today-run-command-hero/,
  'Today Run hero should opt into the redesigned command hero layer.',
);

assert.match(
  pageSource,
  /today-run-plan-hero-panel today-run-command-readiness-panel/,
  'Today Run readiness panel should opt into the redesigned command readiness treatment.',
);

assert.match(
  pageSource,
  /today-run-plan-grid today-run-command-grid/,
  'Today Run lower plan grid should opt into the redesigned command grid.',
);

assert.doesNotMatch(
  pageSource,
  /<ShoeRecommendation\b/,
  'Today Run should not repeat the shoe recommendation as a third standalone card.',
);

assert.match(
  styleSource,
  /\/\* Today Run profile-grid redesign final override \*\//,
  'Today Run should include the final Profile-aligned grid override block.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.runner-shell-canvas\.today-run-command-canvas\s*\{[\s\S]*width:\s*min\(1320px,[\s\S]*max-width:\s*1320px !important;/,
  'Today Run should use the same bounded reading width as Profile.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-coaching-strip-inner\s*\{[\s\S]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\) !important;/,
  'Today Run coaching signals should use a compact twelve-column dashboard grid.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-coaching-answer--readiness\s*\{[\s\S]*grid-column:\s*span 4;/,
  'The readiness summary should lead the row without swallowing the full strip.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-command-hero\s*\{[\s\S]*min-height:\s*0;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.16fr\)\s*minmax\(300px,\s*0\.84fr\) !important;/,
  'Today Run hero should keep a compact, balanced two-column decision layout.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-command-readiness-panel::before\s*\{[\s\S]*display:\s*none;/,
  'The duplicated decorative readiness dial should not compete with the page information.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-command-hero-copy h1\s*\{[\s\S]*color:\s*var\(--tr-command-ink\) !important;/,
  'The dark workout focal card should keep a readable heading in light theme.',
);

assert.match(
  contrastSource,
  /#root \.today-run-command-page \.today-run-command-hero\s*\{[\s\S]*--tr-command-ink:\s*#fffaf2;[\s\S]*--tr-command-accent:\s*#ffad9a;/,
  'The Today Run decision grid should own a stable high-contrast midnight palette.',
);

assert.match(
  contrastSource,
  /\.today-run-plan-panel-copy h2,[\s\S]*\.today-run-plan-hero-metrics strong,[\s\S]*\.today-run-plan-panel-grid strong,[\s\S]*color:\s*var\(--tr-command-ink\) !important;/,
  'The hero headline and readiness metrics should not inherit dark Profile ink.',
);

assert.match(
  contrastSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.today-run-command-page \.today-run-command-hero\s*\{[\s\S]*padding:\s*0 !important;[\s\S]*background:\s*transparent !important;[\s\S]*box-shadow:\s*none !important;/,
  'Light themes should remove the shared outer card so the decision grid can split into two panels.',
);

assert.match(
  contrastSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.today-run-command-page \.today-run-command-hero-copy\s*\{[\s\S]*border:\s*1px solid var\(--runner-profile-line,[\s\S]*linear-gradient\(145deg,\s*rgba\(255, 253, 247, 0\.98\),\s*rgba\(244, 235, 223, 0\.96\)\);/,
  'The left briefing column should become its own Profile paper panel.',
);

assert.match(
  contrastSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.today-run-command-page \.today-run-command-readiness-panel\s*\{[\s\S]*align-self:\s*stretch;[\s\S]*rgba\(250, 245, 236, 0\.84\) !important;/,
  'The right readiness column should remain a distinct full-height light panel.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-plan-grid\.today-run-command-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.15fr\)\s*minmax\(300px,\s*0\.85fr\) !important;/,
  'Workout details and coach context should remain balanced without an oversized rail.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-plan-panel-grid\s*\{[\s\S]*background:\s*transparent !important;[\s\S]*backdrop-filter:\s*none !important;/,
  'The shared glass sweep should not paint the readiness metric wrapper as another card.',
);

assert.match(
  styleSource,
  /var\(--runner-profile-card/,
  'Today Run cards should reuse the Profile surface language.',
);

assert.doesNotMatch(
  styleSource,
  /min-height:\s*clamp\(640px,\s*62vw,\s*840px\)/,
  'Today Run should not reserve a billboard-sized hero height.',
);

assert.doesNotMatch(
  styleSource,
  /font-size:\s*clamp\(3\.35rem,\s*6\.4vw,\s*7\.35rem\)/,
  'Today Run should not use the former oversized hero heading.',
);

assert.match(
  liquidGlassSource,
  /@media \(max-width:\s*860px\)\s*\{[\s\S]*\.runner-shell-page > \.runner-shell-sidebar\s*\{[\s\S]*position:\s*static;/,
  'The shared glass shell must not cover Profile-aligned pages with a fixed full-height sidebar on mobile.',
);

console.log('[PASS] Today Run command deck redesign guard passed.');
