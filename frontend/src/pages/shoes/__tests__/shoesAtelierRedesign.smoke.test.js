import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const shoesSource = read('./pages/shoes/Shoes.jsx');
const indexCss = read('./index.css');
const atelierCss = read('./styles/shoes-atelier-redesign.css');

const assertIncludes = (source, snippet, label) => {
  assert.ok(source.includes(snippet), `${label} missing: ${snippet}`);
};

assertIncludes(shoesSource, 'shoes-dashboard-page shoes-atelier-redesign', 'Shoes page route redesign hook');
assertIncludes(shoesSource, 'shoe-inventory-screen shoes-dashboard-shell shoes-atelier-shell', 'Shoes page shell redesign hook');

assertIncludes(indexCss, "@import './styles/shoes-atelier-redesign.css';", 'late Shoes redesign import');
assert.ok(
  indexCss.indexOf("@import './styles/contrast-fixes.css';") < indexCss.indexOf("@import './styles/shoes-atelier-redesign.css';"),
  'Shoes redesign CSS should load after contrast fixes so route-specific decisions win.',
);
assert.ok(
  indexCss.indexOf("@import './styles/dark-mode-final-fixes.css';") < indexCss.indexOf("@import './styles/shoes-atelier-redesign.css';"),
  'Shoes redesign CSS should load after dark-mode final fixes.',
);

[
  '/* Shoes atelier redesign.',
  'Reference source: design.md Kinetic Editorial.',
  '#root .shoes-atelier-redesign .shoe-inventory-stage',
  '#root .shoes-atelier-redesign .shoe-rotation-signal',
  '#root .shoes-atelier-redesign .shoe-inventory-manage-grid',
  'grid-template-columns: minmax(170px, 0.7fr) minmax(0, 1.2fr) minmax(210px, 0.8fr);',
  '#root .shoes-atelier-redesign .shoe-inventory-card {',
  // Stacked rows (card-top → metrics → actions); card-top carries the
  // art/copy/side track grid. See shoeInventoryCardLayout.smoke.test.js.
  'grid-template-columns: minmax(0, 1fr);',
  'border-radius: 8px;',
  '#root .shoes-atelier-redesign .shoe-inventory-topbar {',
  'position: relative;',
  '#root .shoe-edit-modal-card {',
  '#root .shoe-edit-modal-fields {',
  '#root .shoe-edit-field input:focus {',
  '#root .shoe-edit-modal-actions {',
  'body:is(.theme-midnight, .theme-high-contrast) #root .shoe-edit-modal-card',
  '#root .shoe-photo-modal-card {',
  '#root .shoe-photo-studio {',
  '#root .shoe-photo-studio-layout {',
  '#root .shoe-photo-studio-preview-panel,',
  '#root .shoe-photo-studio-tool-panel,',
  '#root .shoe-photo-studio-search-panel {',
  '#root .shoe-photo-studio-results {',
  '#root .shoe-photo-studio-input:focus',
  'body:is(.theme-midnight, .theme-high-contrast) #root .shoe-photo-modal-card',
  '@media (max-width: 760px)',
  'grid-template-columns: minmax(0, 1fr);',
  'body:is(.theme-midnight, .theme-high-contrast) #root .shoes-atelier-redesign',
].forEach((snippet) => assertIncludes(atelierCss, snippet, 'Shoes atelier CSS'));

assert.match(
  atelierCss,
  /#root \.shoes-atelier-redesign \.shoe-inventory-search\s*\{[\s\S]*background:\s*#f1f2f2;[\s\S]*box-shadow:\s*none;/,
  'Shoes search bar should use the shared light-grey surface without an inset strip',
);
assert.match(
  atelierCss,
  /#root \.shoes-atelier-redesign \.shoe-inventory-search input\s*\{[\s\S]*background:\s*transparent\s*!important;/,
  'Shoes search input should stay transparent so no white strip appears behind the text',
);
assert.match(
  atelierCss,
  /#root \.shoes-atelier-redesign \.shoe-inventory-card-image\s*\{[\s\S]*display:\s*grid;[\s\S]*place-items:\s*center;[\s\S]*height:\s*144px;/,
  'Shoe card image frame should have a definite centered desktop slot',
);
assert.match(
  atelierCss,
  /#root \.shoes-atelier-redesign \.shoe-inventory-card-image \.shoe-img\s*\{[\s\S]*object-fit:\s*contain;[\s\S]*object-position:\s*center;/,
  'Shoe card image should center the processed image inside its frame',
);

[
  'shellClassName="shoe-edit-modal-shell"',
  'cardClassName="shoe-edit-modal-card"',
  'className="shoe-edit-modal-form"',
  'className="shoe-edit-modal-fields"',
  'className="shoe-edit-field shoe-edit-field--wide"',
  'className="shoe-edit-primary-toggle shoe-checkbox-label"',
  'className="shoe-edit-modal-actions modal-actions"',
].forEach((snippet) => assertIncludes(shoesSource, snippet, 'Shoes edit modal redesign JSX'));

[
  'shellClassName="shoe-photo-modal-shell"',
  'cardClassName="shoe-photo-modal-card"',
  'className="shoe-photo-studio"',
  'className="shoe-photo-studio-layout"',
  'className="shoe-photo-studio-preview-panel"',
  'className="shoe-photo-studio-tool-panel"',
  'className="shoe-photo-studio-search-panel"',
].forEach((snippet) => assertIncludes(shoesSource, snippet, 'Shoes photo modal redesign JSX'));

assert.doesNotMatch(
  shoesSource,
  /settings-modal-card img-picker-modal-card|cardClassName="img-picker-modal-card shoe-photo-modal-card"|className="img-picker-layout"/,
  'Shoes photo modal must not render the legacy img-picker modal structure.',
);

assert.doesNotMatch(
  atelierCss,
  /font-size:\s*[^;]*vw/i,
  'Shoes atelier redesign must not scale font size with viewport width.',
);

assert.doesNotMatch(
  atelierCss,
  /letter-spacing:\s*-/i,
  'Shoes atelier redesign must not use negative letter spacing.',
);

assert.match(
  read('../package.json'),
  /"test:contracts":\s*"node scripts\/run-tests\.mjs"/,
  'npm test should keep using the contract runner that discovers this guardrail.',
);

console.log('[PASS] Shoes atelier redesign guardrails passed.');
