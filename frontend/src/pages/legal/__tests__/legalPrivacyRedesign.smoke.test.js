import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, "../LegalPage.jsx"), 'utf8');
const splitCss = readFileSync(join(here, "../../../styles/_split/misc.css"), 'utf8');
const bundledCss = readFileSync(join(here, "../../../styles/style.generated.css"), 'utf8');

const requiredPageSnippets = [
  "import { Database, FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react';",
  'legal-page--${variant}',
  'privacy-hero-panel',
  'privacy-signal-strip',
  'privacySignals.map',
];

const requiredCssSnippets = [
  '.legal-page--privacy',
  '.privacy-hero-panel',
  '.privacy-signal-strip',
  '#f6f3ec',
  '#27221e',
  'rgba(255, 255, 255, 0.72)',
  '@keyframes legal-privacy-breathe',
  '@media (max-width: 640px)',
  'min-height: 100dvh',
];

for (const snippet of requiredPageSnippets) {
  if (!pageSource.includes(snippet)) {
    throw new Error(`LegalPage.jsx is missing privacy redesign snippet: ${snippet}`);
  }
}

for (const snippet of requiredCssSnippets) {
  if (!splitCss.includes(snippet)) {
    throw new Error(`_split/misc.css is missing privacy redesign snippet: ${snippet}`);
  }

  if (!bundledCss.includes(snippet)) {
    throw new Error(`style.css is missing privacy redesign snippet: ${snippet}`);
  }
}

if (/\.legal-page-hero h1\s*\{[^}]*letter-spacing:\s*-/s.test(splitCss)) {
  throw new Error('Legal privacy heading styles must not use negative letter spacing.');
}

if (/\.legal-page--privacy\s*\{[^}]*#121110/s.test(splitCss)) {
  throw new Error('Privacy page must use the HermesRuns light-mode palette, not the dark editorial background.');
}

if (!pageSource.includes('<HermesLogo tone="light" />')) {
  throw new Error('Light-mode legal header must render the logo for light backgrounds (navy symbol tile, navy and brick logotype).');
}

console.log('[PASS] Legal privacy redesign guard passed.');
