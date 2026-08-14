import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const readOptional = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
};

const addShoesSource = read('pages/AddShoes.jsx');
const indexCss = read('index.css');
const redesignCss = readOptional('styles/add-shoes-profile-alignment.css');

const assertIncludes = (source, snippet, label) => {
  assert.ok(source.includes(snippet), `${label} missing: ${snippet}`);
};

assertIncludes(addShoesSource, 'add-shoes-page add-shoes-profile-redesign', 'Add Shoes Profile redesign hook');
assertIncludes(addShoesSource, 'data-design-reference="profile-dashboard"', 'Add Shoes Profile reference lock');
assertIncludes(addShoesSource, 'add-shoes-brand-deck-feature', 'Add Shoes featured brand decision card');

assertIncludes(indexCss, "@import './styles/add-shoes-profile-alignment.css';", 'late Add Shoes Profile redesign import');
assert.ok(
  indexCss.indexOf("@import './styles/all-pages-liquid-glass.css';") < indexCss.indexOf("@import './styles/add-shoes-profile-alignment.css';"),
  'Add Shoes Profile CSS should load after shared liquid-glass rules.',
);
assert.ok(
  indexCss.indexOf("@import './styles/dark-mode-cohesion.css';") < indexCss.indexOf("@import './styles/add-shoes-profile-alignment.css';"),
  'Add Shoes Profile CSS should be the final route-level design authority.',
);

assert.match(
  redesignCss,
  /#root \.add-shoes-profile-redesign \.add-shoes-canvas\s*\{[\s\S]*width:\s*min\(calc\(100% - 48px\),\s*1500px\)[\s\S]*max-width:\s*1500px[\s\S]*margin-inline:\s*auto[\s\S]*padding:\s*24px 0 52px/,
  'Add Shoes canvas should use a capped centered Profile grid.',
);

[
  'Reference source: current Profile dashboard',
  '--profile-paper: #fffaf3;',
  '--profile-ink: #211c18;',
  '#root .add-shoes-profile-redesign .add-shoes-editorial-hero',
  'grid-template-columns: repeat(16, minmax(0, 1fr));',
  '#root .add-shoes-profile-redesign .add-shoes-editorial-hero-main',
  'grid-column: span 10;',
  '#root .add-shoes-profile-redesign .add-shoes-editorial-hero-rail',
  'grid-column: span 6;',
  '#root .add-shoes-profile-redesign .add-shoes-browser-panel.add-shoes-stage',
  '#root .add-shoes-profile-redesign .add-shoes-brand-deck-feature',
  '#root .add-shoes-profile-redesign .add-shoes-selected-summary',
  '#root .add-shoes-profile-redesign .add-shoes-model-board .add-shoes-model-grid',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '#root .add-shoes-profile-redesign .add-shoes-setup-payload-shell',
  'grid-template-columns: minmax(280px, 6fr) minmax(0, 10fr);',
  'body:is(.theme-midnight, .theme-high-contrast) #root .add-shoes-profile-redesign',
  '@media (max-width: 1180px)',
  '@media (max-width: 760px)',
  '@media (prefers-reduced-motion: reduce)',
  'grid-template-columns: minmax(0, 1fr);',
].forEach((snippet) => assertIncludes(redesignCss, snippet, 'Add Shoes Profile CSS'));

assert.doesNotMatch(
  redesignCss,
  /font-size:\s*[^;]*vw/i,
  'Add Shoes Profile redesign must not scale typography directly with viewport width.',
);

console.log('[PASS] Add Shoes profile redesign guardrails passed.');
