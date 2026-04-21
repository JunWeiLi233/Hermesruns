import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, 'Analysis.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

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

console.log('[PASS] Analysis VDOT trend accent guardrails passed.');
