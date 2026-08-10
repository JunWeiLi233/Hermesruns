import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(path.join(here, '../index.css'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  indexSource.includes("@import './styles/all-pages-liquid-glass.css';"),
  'The cross-page liquid-glass layer should load after the existing page-specific styles.',
);

assert(
  styleSource.includes('.runner-shell-page .runner-shell-sidebar')
    && styleSource.includes('.admin-command-page :is(')
    && styleSource.includes('.auth-page,')
    && styleSource.includes('.legal-page .legal-page-shell'),
  'Runner, admin, auth, and legal shells should all opt into the shared material language.',
);

assert(
  /\.runner-shell-page > \.runner-shell-sidebar\s*\{[\s\S]*position:\s*fixed;[\s\S]*z-index:\s*30;/.test(styleSource)
    && /\.runner-shell-page > \.runner-shell-main\s*\{[\s\S]*position:\s*relative;/.test(styleSource),
  'The shared layer must preserve the fixed runner rail instead of pushing every page grid below the viewport.',
);

assert(
  styleSource.includes('backdrop-filter: blur(var(--hermes-glass-blur)) saturate(138%)')
    && styleSource.includes('@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px)))')
    && styleSource.includes('@media (prefers-reduced-motion: reduce)'),
  'The shared treatment should provide frosted depth, a browser fallback, and reduced-motion behavior.',
);

assert(
  styleSource.includes(':not([class*="chart"])')
    && styleSource.includes(':not([class*="map"])')
    && styleSource.includes(':not([class*="modal"])'),
  'Data visualization and interaction layers should remain excluded from broad glass surface styling.',
);

console.log('[PASS] Cross-page liquid-glass guardrails passed.');
