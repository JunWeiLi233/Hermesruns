import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const loginSource = readFileSync(path.join(here, 'Login.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const translationsSource = readFileSync(path.join(here, '../i18n/translations.js'), 'utf8');

assert.match(
  loginSource,
  /authBrandSlides\s*=/,
  'Login should define a reusable slide list for the brand introduction carousel.',
);

assert.match(
  loginSource,
  /auth-flow-slide-track/,
  'Login brand intro should render a rolling slide track inside auth-flow-brand-inner.',
);

assert.match(
  loginSource,
  /auth-flow-slide/,
  'Login brand intro should render individual slide panels instead of one static copy block.',
);

assert.match(
  styleSource,
  /@keyframes authFlowSlideRoll/,
  'Login brand intro styles should define the rolling slide animation.',
);

assert.match(
  styleSource,
  /\.auth-flow-slide-track\s*\{/,
  'Login brand intro styles should define the slide track.',
);

assert.match(
  styleSource,
  /prefers-reduced-motion:\s*reduce[\s\S]*auth-flow-slide-track/,
  'Login brand intro should respect reduced-motion users.',
);

assert.match(
  translationsSource,
  /"stitch_slide_1_kicker":/,
  'Login carousel copy should be translated in the index namespace.',
);

assert.match(
  translationsSource,
  /"stitch_slide_3_copy":/,
  'Login carousel should include all three translated slide copy entries.',
);

console.log('[PASS] Login brand carousel guardrails passed.');
