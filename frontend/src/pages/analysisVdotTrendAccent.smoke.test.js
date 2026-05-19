import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, 'Analysis.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  analysisSource,
  /<article className="analysis-overview-card analysis-overview-card--vo2 analysis-profile-primary">/,
  'Analysis VO2 trend grid should keep rendering as a static profile-cockpit article, not as a clickable navigation button.',
);

assert.doesNotMatch(
  analysisSource,
  /navigate\('\/analysis\/vo2max'\)/,
  'Analysis overview should not navigate from the VO2 trend grid to the removed VO2max detail page.',
);

assert.doesNotMatch(
  analysisSource,
  /analysis-overview-card--vo2-clickable|analysis-overview-vo2-link-row/,
  'Analysis VO2 trend grid should not keep clickable-only classes or CTA rows.',
);

assert.match(
  analysisSource,
  /const loadZoneTone = loadZone\.tone === 'cool' \? 'muted' : loadZone\.tone;/,
  'Analysis overview should normalize the cool ACWR tone to the muted pill variant.',
);

assert.match(
  analysisSource,
  /const analysisLoadTheme = loadZone\.tone === 'danger' \? 'red' : loadZone\.tone === 'warn' \? 'yellow' : 'green';/,
  'Analysis page should derive a green/yellow/red theme from the current training-load tone.',
);

assert.match(
  analysisSource,
  /data-analysis-load-theme=\{analysisLoadTheme\}/,
  'Analysis route root should expose the training-load theme to CSS with a data attribute.',
);

assert.match(
  analysisSource,
  /analysis-overview-card analysis-overview-card--insight analysis-overview-card--vdot-insight[\s\S]*?<p className="analysis-overview-insight-copy">/,
  'Analysis VDOT trend card should keep the dedicated insight class on the overview card and copy paragraph so the accent color can stay scoped to this surface.',
);

assert.match(
  styleSource,
  /body\.theme-light\s+\.analysis-overview-card--vdot-insight\s+\.analysis-overview-insight-copy,\s*body\.theme-high-contrast-light\s+\.analysis-overview-card--vdot-insight\s+\.analysis-overview-insight-copy\s*\{[^}]*color:\s*#2d0d08;/,
  'Analysis VDOT trend insight copy should use the same text color as the Hermes coach card headline on light surfaces.',
);

assert.match(
  styleSource,
  /\/\* Analysis full-width canvas repair \*\//,
  'Analysis styles should keep a named full-width canvas repair guardrail.',
);

const analysisLabStart = styleSource.indexOf('/* Analysis physiology lab redesign */');
assert.notEqual(
  analysisLabStart,
  -1,
  'Analysis should include a named physiology lab redesign layer after the shared runner-page styles.',
);
const analysisLabEnd = styleSource.indexOf('/* Runner-facing Profile alignment pass */', analysisLabStart);
const analysisLabBlock = styleSource.slice(
  analysisLabStart,
  analysisLabEnd === -1 ? styleSource.length : analysisLabEnd,
);

assert.ok(
  analysisLabStart > styleSource.indexOf('/* Analysis full-width canvas repair */'),
  'Analysis physiology lab redesign should come after the older full-width repair so it wins the route cascade.',
);

for (const token of [
  '--analysis-lab-paper',
  '--analysis-lab-surface',
  '--analysis-lab-ink',
  '--analysis-lab-accent',
  '--analysis-lab-accent-dark',
  '--analysis-lab-accent-rgb',
  '--analysis-lab-accent-soft',
  '--analysis-lab-blue',
]) {
  assert.match(analysisLabBlock, new RegExp(token), `Analysis physiology lab should define ${token}.`);
}

for (const [theme, accent] of [
  ['green', '#0f766e'],
  ['yellow', '#b7791f'],
  ['red', '#b94a3f'],
]) {
  assert.match(
    analysisLabBlock,
    new RegExp(`\\.analysis-page-shell\\[data-analysis-load-theme="${theme}"\\]\\s*\\{[\\s\\S]*--analysis-lab-accent:\\s*${accent};`),
    `Analysis physiology lab should define a ${theme} load theme with the expected accent.`,
  );
}

assert.match(
  analysisLabBlock,
  /rgba\(var\(--analysis-lab-accent-rgb\),\s*0\.1\)/,
  'Analysis physiology lab should drive atmospheric washes from the current load accent RGB token.',
);

assert.match(
  analysisLabBlock,
  /\.analysis-page-shell \.analysis-profile-reference-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  'Analysis reference rail should become a two-column live-signal grid on desktop.',
);

assert.match(
  analysisLabBlock,
  /\.analysis-page-shell \.analysis-profile-reference-card\.is-load\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1;[\s\S]*background:[\s\S]*linear-gradient\(135deg,\s*var\(--analysis-lab-accent-soft\),\s*#fbfffb\)\s*!important;/,
  'Analysis load card should be a light load-themed lab panel spanning the reference grid, not a dark card.',
);

assert.match(
  analysisLabBlock,
  /\/\* Analysis physiology lab specificity clamp \*\/[\s\S]*\.analysis-page-shell\.analysis-page-shell :is\([\s\S]*\.analysis-overview-card\.analysis-overview-card,[\s\S]*\.analysis-injury-prevention-section\.analysis-injury-prevention-section[\s\S]*\)\s*\{[\s\S]*border-radius:\s*8px\s*!important;[\s\S]*background:\s*var\(--analysis-lab-surface\)\s*!important;/,
  'Analysis lab should include a high-specificity direct-mount clamp that beats the shared route-card clamp.',
);

const analysisContrastStart = analysisLabBlock.indexOf('/* Analysis VO2 contrast repair */');
assert.notEqual(
  analysisContrastStart,
  -1,
  'Analysis should keep a named VO2 contrast repair so pale cream text cannot return on the trend card.',
);
const analysisContrastEnd = analysisLabBlock.indexOf(
  '.analysis-page-shell.analysis-page-shell .analysis-profile-reference-card.analysis-profile-reference-card',
  analysisContrastStart,
);
const analysisContrastBlock = analysisLabBlock.slice(
  analysisContrastStart,
  analysisContrastEnd === -1 ? analysisLabBlock.length : analysisContrastEnd,
);

for (const selector of [
  '.analysis-overview-card-head h2',
  '.analysis-overview-hero-value strong',
  '.analysis-profile-decision-chip strong',
  '.analysis-overview-card--forecast > strong',
  '.analysis-overview-gauge-value',
]) {
  assert.match(
    analysisContrastBlock,
    new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Analysis VO2 contrast repair should cover ${selector}.`,
  );
}

assert.match(
  analysisContrastBlock,
  /color:\s*var\(--analysis-lab-accent\)\s*!important;/,
  'Analysis VO2 title, values, and trend metrics should use the same load accent as the VO2 bars.',
);

assert.match(
  analysisContrastBlock,
  /color:\s*var\(--analysis-lab-accent-dark\)\s*!important;/,
  'Analysis VO2 secondary labels should use a readable companion color instead of pale cream.',
);

assert.doesNotMatch(
  analysisContrastBlock,
  /#fff4e6|#fff8ee|rgb\(255,\s*244,\s*230\)/i,
  'Analysis VO2 contrast repair should not use the rejected pale cream text color.',
);

assert.match(
  analysisLabBlock,
  /\.analysis-page-shell :is\([\s\S]*\.analysis-overview-card,[\s\S]*\.analysis-injury-prevention-section[\s\S]*\)\s*\{[\s\S]*border-radius:\s*8px\s*!important;[\s\S]*box-shadow:/,
  'Analysis cards should use the new compact light-lab card geometry.',
);

assert.doesNotMatch(
  analysisLabBlock,
  /#302920|#1d1914|#111111|var\(--runner-atlas-dark\)/,
  'Analysis physiology lab should not reintroduce the rejected dark graphite grid/card treatment.',
);

assert.match(
  styleSource,
  /\.analysis-page-shell\s+\.runner-shell-canvas,\s*\.hermes-site-frame\[data-gpt-taste-system="gpt-taste"\]\[data-route-path="\/analysis"\]\s+\.analysis-page-shell\s+\.runner-shell-canvas\s*\{[\s\S]*width:\s*auto\s*!important;[\s\S]*max-width:\s*none\s*!important;[\s\S]*margin:\s*0\s+clamp\(16px,\s*1\.8vw,\s*34px\)\s+0\s+clamp\(22px,\s*2\.4vw,\s*46px\)\s*!important;[\s\S]*padding:\s*clamp\(22px,\s*2\.6vw,\s*46px\)\s+0\s+clamp\(56px,\s*6vw,\s*108px\)\s*!important;/,
  'Analysis canvas should override the shared 1390px runner-dashboard cap in both direct and site-frame mounts.',
);

assert.match(
  styleSource,
  /@media\s+\(min-width:\s*1440px\)\s*\{[\s\S]*\.analysis-page-shell\s+\.analysis-profile-cockpit,\s*\.hermes-site-frame[\s\S]*\.analysis-profile-cockpit\s*\{[\s\S]*grid-template-columns:\s*minmax\(680px,\s*1\.18fr\)\s+minmax\(420px,\s*0\.82fr\)\s*!important;[\s\S]*\.analysis-page-shell\s+\.analysis-profile-table-grid,\s*\.hermes-site-frame[\s\S]*\.analysis-profile-table-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.12fr\)\s+minmax\(380px,\s*0\.88fr\)\s*!important;/,
  'Analysis wide desktop grid should expand the hero and lower table grids instead of leaving a right gutter empty.',
);

assert.match(
  styleSource,
  /@media\s+\(min-width:\s*1440px\)\s*\{[\s\S]*\.analysis-page-shell\s+\.analysis-profile-bento-grid,\s*\.hermes-site-frame[\s\S]*\.analysis-profile-bento-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*\.analysis-page-shell\s+\.analysis-overview-card--intensity,\s*\.hermes-site-frame[\s\S]*\.analysis-overview-card--intensity\s*\{[\s\S]*grid-column:\s*span\s*5;[\s\S]*\.analysis-page-shell\s+\.analysis-overview-card--injury,\s*\.hermes-site-frame[\s\S]*\.analysis-overview-card--injury\s*\{[\s\S]*grid-column:\s*span\s*4;[\s\S]*\.analysis-page-shell\s+\.analysis-overview-card--forecast,\s*\.hermes-site-frame[\s\S]*\.analysis-overview-card--forecast\s*\{[\s\S]*grid-column:\s*span\s*3;/,
  'Analysis wide desktop bento cards should span the full 12-column grid in both direct and site-frame mounts.',
);

assert.match(
  styleSource,
  /@media\s+\(max-width:\s*1180px\)\s*\{[\s\S]*\.analysis-page-shell\s+\.analysis-overview-grid--summary,\s*\.hermes-site-frame[\s\S]*\.analysis-overview-grid--summary\s*\{[\s\S]*grid-template-columns:\s*1fr\s*!important;[\s\S]*\.analysis-page-shell\s+\.analysis-overview-grid--summary\s*>\s*\*,\s*\.hermes-site-frame[\s\S]*\.analysis-overview-grid--summary\s*>\s*\*\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1\s*!important;/,
  'Analysis responsive bento cards should collapse to full-width rows in both direct and site-frame mounts.',
);

assert.match(
  styleSource,
  /@media\s+\(max-width:\s*760px\)\s*\{[\s\S]*\.analysis-page-shell\s+\.analysis-profile-primary\s+\.analysis-overview-card-head,\s*\.analysis-page-shell\s+\.analysis-profile-reference-grid,\s*\.hermes-site-frame[\s\S]*\.analysis-profile-reference-grid\s*\{[\s\S]*grid-template-columns:\s*1fr;[\s\S]*\.analysis-page-shell\s+\.analysis-profile-reference-card\.is-load,\s*\.hermes-site-frame[\s\S]*\.analysis-profile-reference-card\.is-load\s*\{[\s\S]*grid-template-areas:[\s\S]*"label"[\s\S]*"gauge"[\s\S]*"value"[\s\S]*"status"[\s\S]*"copy";/,
  'Analysis mobile reference cards should collapse in direct mounts, not only under the absent site-frame wrapper.',
);

assert.doesNotMatch(
  styleSource,
  /analysis-overview-status-pill\.is-cool|analysis-overview-card--vo2-clickable|analysis-overview-vo2-link-row/,
  'Analysis overview styles should not keep the removed cool status pill or VO2 click affordance selectors.',
);

console.log('[PASS] Analysis VDOT trend accent guardrails passed.');
