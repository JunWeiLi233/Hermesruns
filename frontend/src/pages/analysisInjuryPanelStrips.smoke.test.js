import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(path.join(here, '../index.css'), 'utf8');
const detailSource = readFileSync(path.join(here, 'AnalysisInsightDetail.jsx'), 'utf8');
const liquidGlassSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

assert.match(
  detailSource,
  /className="analysis-cinematic-hero analysis-profile-v2-header"/,
  'Injury-risk detail should keep the Profile score-header structure that the strip reset targets.',
);

assert.match(
  detailSource,
  /className="analysis-cinematic-signal-row analysis-profile-v2-metric-strip"/,
  'Injury-risk detail should preserve its signal row while promoting it to the Profile-style metric strip.',
);

const cardSweepIndex = liquidGlassSource.lastIndexOf('[class*="-card"]');
const stripResetIndex = liquidGlassSource.lastIndexOf(
  '.runner-shell-page.analysis-insight-detail-page.is-injury-risk :is(',
);

assert.ok(
  stripResetIndex > cardSweepIndex,
  'The injury-risk panel-strip reset must remain after the shared liquid-glass card sweep.',
);

assert.match(
  liquidGlassSource.slice(stripResetIndex),
  /\.analysis-cinematic-card-head,\s*\.analysis-cinematic-signal-row > div\s*\)\s*\{[\s\S]*background:\s*transparent\s*!important[\s\S]*background-image:\s*none\s*!important[\s\S]*box-shadow:\s*none\s*!important/,
  'Injury-risk detail must keep nested headings and signal cells on the parent card surface.',
);

assert.ok(
  indexSource.indexOf("@import './styles/all-pages-liquid-glass.css';") > indexSource.indexOf("@import './styles/_split/light-theme-overrides.css';"),
  'The late liquid-glass override must load after the light-theme signal-cell surface.',
);
