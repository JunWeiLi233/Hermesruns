import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, 'Analysis.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  analysisSource,
  /<article className="analysis-overview-card analysis-overview-card--vo2">/,
  'Analysis VO2 trend grid should render as a static article, not as a clickable navigation button.',
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
  /analysis-overview-card analysis-overview-card--insight analysis-overview-card--vdot-insight[\s\S]*?<p className="analysis-overview-insight-copy">/,
  'Analysis VDOT trend card should keep the dedicated insight class on the overview card and copy paragraph so the accent color can stay scoped to this surface.',
);

assert.match(
  styleSource,
  /body\.theme-light\s+\.analysis-overview-card--vdot-insight\s+\.analysis-overview-insight-copy,\s*body\.theme-high-contrast-light\s+\.analysis-overview-card--vdot-insight\s+\.analysis-overview-insight-copy\s*\{[^}]*color:\s*#2d0d08;/,
  'Analysis VDOT trend insight copy should use the same text color as the Hermes coach card headline on light surfaces.',
);

assert.doesNotMatch(
  styleSource,
  /analysis-overview-status-pill\.is-cool|analysis-overview-card--vo2-clickable|analysis-overview-vo2-link-row/,
  'Analysis overview styles should not keep the removed cool status pill or VO2 click affordance selectors.',
);

console.log('[PASS] Analysis VDOT trend accent guardrails passed.');
