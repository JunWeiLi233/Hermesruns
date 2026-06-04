import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const contrastFixes = readFileSync(path.join(here, '../styles/contrast-fixes.css'), 'utf8');

assert.match(
  runsSource,
  /<div className="recent-runs-hero-overlay" \/>/,
  'Runs hero should mount the overlay layer used by the light-mode contrast repair.',
);

assert.match(
  contrastFixes,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+#root\s+\.runs-dashboard-page\s+\.recent-runs-hero--dashboard\s+\.recent-runs-hero-copy\s*\{[\s\S]*color:\s*#fff8ee\s*!important;[\s\S]*text-shadow:/,
  'Runs image hero copy should stay light with text shadow in light mode so it remains readable over the generated photo.',
);

assert.match(
  contrastFixes,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+#root\s+\.runs-dashboard-page\s+\.recent-runs-hero--dashboard\s+\.recent-runs-hero-copy\s+:is\(h1,\s*h2,\s*p,\s*span,\s*small,\s*em\)\s*\{[\s\S]*color:\s*inherit\s*!important;/,
  'Runs image hero descendants should inherit the light hero copy color instead of the broad muted runner-shell span and paragraph clamp.',
);

assert.match(
  contrastFixes,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+#root\s+\.runs-dashboard-page\s+\.recent-runs-hero--dashboard\s+\.recent-runs-hero-overlay::after\s*\{[\s\S]*rgba\(18,\s*16,\s*13,\s*0\.9\)/,
  'Runs image hero should use a dark left-side overlay in light mode so copy has enough contrast over the image.',
);

console.log('[PASS] Runs hero overlay contrast guardrails passed.');
