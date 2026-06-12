import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

const atlasBlockStart = styleSource.indexOf('/* Runner atlas style refresh final override */');
assert.notEqual(atlasBlockStart, -1, 'Runner atlas style refresh should be recorded as a final override block.');

const atlasBlock = styleSource.slice(atlasBlockStart);
const minimalistBlockStart = styleSource.indexOf('/* Runner minimalist UI light override */');
assert.notEqual(minimalistBlockStart, -1, 'Runner pages should include the minimalist UI light override requested after the dark atlas pass.');
const minimalistBlockEnd = styleSource.indexOf('/* Profile grid style refresh final override */', minimalistBlockStart);
const minimalistBlock = styleSource.slice(
  minimalistBlockStart,
  minimalistBlockEnd === -1 ? styleSource.length : minimalistBlockEnd,
);
const finalClampStart = styleSource.indexOf('/* Runner minimalist final clamp */');
assert.notEqual(finalClampStart, -1, 'Runner pages should include a final minimalist clamp after route-local styles.');
assert.ok(
  finalClampStart > minimalistBlockStart,
  'The final minimalist clamp should come after the light override so route-local dark/card styles cannot win the cascade.',
);
const finalClampEnd = styleSource.indexOf('/* Profile first-fold decision-map refinement */', finalClampStart);
const finalClampBlock = styleSource.slice(
  finalClampStart,
  finalClampEnd === -1 ? styleSource.length : finalClampEnd,
);

for (const selector of [
  '.analysis-page-shell',
  '.runs-dashboard-page',
  '.weather-engine-page',
  '.shoes-dashboard-page',
  '.races-dashboard-page',
  '.schedule-plan-page',
  '.runner-dashboard-page:has(.muscle-training-page)',
]) {
  assert.match(atlasBlock, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Atlas refresh should target ${selector}.`);
}

for (const token of [
  '--runner-atlas-paper',
  '--runner-atlas-card',
  '--runner-atlas-ink',
  '--runner-atlas-accent',
  '--runner-atlas-dark',
]) {
  assert.match(atlasBlock, new RegExp(token), `Atlas refresh should define ${token}.`);
}

for (const token of [
  '--runner-minimal-canvas',
  '--runner-minimal-surface',
  '--runner-minimal-ink',
  '--runner-minimal-muted',
  '--runner-minimal-line',
]) {
  assert.match(minimalistBlock, new RegExp(token), `Minimalist override should define ${token}.`);
}

assert.match(
  atlasBlock,
  /\.runner-shell-canvas\s*\{[\s\S]*width:\s*auto\s*!important;[\s\S]*max-width:\s*none\s*!important;[\s\S]*margin:\s*0\s+clamp\(16px,\s*2\.2vw,\s*42px\)\s+0\s+clamp\(22px,\s*2\.8vw,\s*54px\)\s*!important;/,
  'Requested pages should use the available runner-shell canvas width instead of the old centered 1120px cap.',
);

assert.match(
  minimalistBlock,
  /\.runner-shell-canvas::before\s*\{[\s\S]*background:[\s\S]*linear-gradient\(90deg,\s*rgba\(17,\s*17,\s*17,\s*0\.028\)\s+1px,\s*transparent\s+1px\)[\s\S]*var\(--runner-minimal-surface-soft\)\s*!important;/,
  'Minimalist override should replace the dark topographic grid with a very light editorial line field.',
);

assert.match(
  minimalistBlock,
  /:is\([\s\S]*\.analysis-profile-primary,[\s\S]*\.recent-runs-hero,[\s\S]*\.weather-engine-hero,[\s\S]*\.shoe-rotation-signal,[\s\S]*\.race-center-hero,[\s\S]*\.schedule-plan-hero,[\s\S]*\.mt-today-card[\s\S]*\)\s*\{[\s\S]*background:\s*var\(--runner-minimal-surface\)\s*!important;[\s\S]*color:\s*var\(--runner-minimal-ink\)\s*!important;/,
  'Requested primary surfaces should be light minimalist cards, not graphite anchors.',
);

assert.match(
  atlasBlock,
  /\.runs-dashboard-page \.recent-runs-stats-grid,[\s\S]*\.muscle-training-page \.strength-plan-content-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.22fr\)\s+minmax\(320px,\s*0\.78fr\)\s*!important;/,
  'Atlas refresh should use asymmetric grids on the requested runner surfaces.',
);

assert.match(
  minimalistBlock,
  /\.runner-dashboard-page:has\(\.muscle-training-page\) \.muscle-training-page \.mt-strength-lab\[data-friendly-strength-lab="true"\] :is\([\s\S]*\.mt-today-card,[\s\S]*\.mt-readiness-card--decision[\s\S]*\)\s*\{[\s\S]*background:\s*var\(--runner-minimal-surface\)\s*!important;[\s\S]*color:\s*var\(--runner-minimal-ink\)\s*!important;/,
  'Muscle Training should specifically override its previous dark anchor cards back to minimalist light surfaces.',
);

assert.match(
  minimalistBlock,
  /border-radius:\s*6px\s*!important;/,
  'Minimalist page buttons should use crisp 6px corners instead of large pill geometry.',
);

assert.match(
  finalClampBlock,
  /\.recent-runs-hero,[\s\S]*\.race-center-hero,[\s\S]*\.mt-today-card[\s\S]*\)\s*\{[\s\S]*border:\s*1px\s+solid\s+#eaeaea\s*!important;[\s\S]*border-radius:\s*12px\s*!important;[\s\S]*background:\s*#ffffff\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/,
  'Final minimalist clamp should keep major route cards flat, white, and 12px-rounded after later route styles.',
);

assert.match(
  minimalistBlock,
  /\.runs-dashboard-page\s+\.recent-runs-insight-card--primary\s+strong\s*\{[\s\S]*background:\s*var\(--runner-minimal-red-bg\)\s*!important;[\s\S]*color:\s*#8f1f1d\s*!important;/,
  'Runs primary insight count should use a visible red highlight instead of the neutral final-clamp ink.',
);

assert.ok(
  styleSource.indexOf('.runs-dashboard-page .recent-runs-insight-card--primary strong', minimalistBlockStart)
    > styleSource.indexOf('.recent-runs-card-metric strong', minimalistBlockStart),
  'Runs primary insight count accent should appear after the broad minimalist strong-text clamp.',
);

assert.doesNotMatch(
  minimalistBlock,
  /#302920|#1d1914|graphite anchor/,
  'Minimalist override should not keep the prior dark graphite card colors.',
);

assert.doesNotMatch(
  finalClampBlock,
  /#302920|#1d1914|graphite anchor/,
  'Final minimalist clamp should not keep the prior dark graphite card colors.',
);

assert.doesNotMatch(
  atlasBlock,
  /data-route-path="\/(admin|dashboard)"/,
  'Atlas refresh must not target admin/operator route selectors.',
);

console.log('[PASS] Runner atlas style refresh guardrails passed.');
