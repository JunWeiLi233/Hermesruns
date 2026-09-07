import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, '../Races.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/_split/races.css"), 'utf8');

assert.match(
  pageSource,
  /className="race-center-hero-image"[\s\S]*?src="\/images\/races\/dashboard-hero\.webp"/,
  'The races dashboard should use the approved running hero image.',
);

assert.match(
  styleSource,
  /@media\s*\(min-width:\s*721px\)[\s\S]*?#root \.races-dashboard-page \.race-center-hero\s*\{[\s\S]*?min-height:\s*clamp\(320px,\s*24vw,\s*350px\);[\s\S]*?#root \.races-dashboard-page \.race-center-hero-body\s*\{[\s\S]*?align-items:\s*flex-start;[\s\S]*?justify-content:\s*center;[\s\S]*?min-height:\s*clamp\(320px,\s*24vw,\s*350px\);[\s\S]*?text-align:\s*left;/,
  'The desktop races hero should use a compact, left-aligned content frame.',
);

assert.match(
  styleSource,
  /@media\s*\(min-width:\s*721px\)[\s\S]*?#root \.races-dashboard-page \.race-center-hero-overlay\s*\{[\s\S]*?background:[\s\S]*?rgba\(24,\s*18,\s*15,\s*0\.94\)[\s\S]*?!important;/,
  'The desktop races hero should keep a dark warm scrim over bright event photography.',
);

assert.match(
  styleSource,
  /@media\s*\(min-width:\s*721px\)[\s\S]*?#root \.races-dashboard-page \.race-center-hero h1\s*\{[\s\S]*?font-size:\s*clamp\(2\.4rem,\s*5\.4vw,\s*4\.6rem\);[\s\S]*?text-align:\s*left;[\s\S]*?color:\s*#fff4e6\s*!important;/,
  'The desktop countdown title should remain readable and subordinate to the page shell.',
);

assert.match(
  styleSource,
  /#root \.races-dashboard-page \.race-center-hero :is\(\s*h1,[\s\S]*?h1 span\s*\)\s*\{[\s\S]*?color:\s*#fff4e6\s*!important;[\s\S]*?-webkit-text-fill-color:\s*#fff4e6\s*!important;/,
  'The desktop title and every title span should paint cream through inherited text-fill rules.',
);

assert.match(
  styleSource,
  /#root \.races-dashboard-page \.race-center-hero p\s*\{[\s\S]*?color:\s*rgba\(255,\s*244,\s*230,\s*0\.86\)\s*!important;/,
  'The desktop hero summary should use readable cream copy over the image.',
);

assert.match(
  styleSource,
  /#root \.races-dashboard-page \.race-center-hero-actions\s*\{[\s\S]*?justify-content:\s*flex-start;/,
  'The desktop races actions should align with the title and summary.',
);

assert.match(
  styleSource,
  /#root \.races-dashboard-page \.race-center-primary-btn\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?background:\s*var\(--accent-coral-strong,\s*#f07561\)\s*!important;[\s\S]*?#root \.races-dashboard-page \.race-center-secondary-btn\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?border:\s*1px solid rgba\(255,\s*248,\s*238,\s*0\.48\)\s*!important;/,
  'The desktop hero should retain clear coral-primary and outlined-secondary actions.',
);

assert.match(
  styleSource,
  /\.race-center-hero-body\s*\{[\s\S]*?min-height:\s*430px;[\s\S]*?box-sizing:\s*border-box;/,
  'The base races hero body should keep a real sizing box for narrow layouts.',
);

assert.match(
  styleSource,
  /@media\s*\(max-width:\s*720px\)[\s\S]*?\.race-center-hero-body\s*\{\s*min-height:\s*360px;/,
  'The races hero body should preserve its contained mobile height.',
);

assert.match(
  styleSource,
  /@media\s*\(max-width:\s*720px\)[\s\S]*?\.race-center-primary-btn,[\s\S]*?\.race-center-secondary-btn\s*\{\s*width:\s*100%;/,
  'The races hero actions should remain contained full-width touch targets on mobile.',
);

console.log('[PASS] Races hero desktop hierarchy and mobile containment guard passed.');
