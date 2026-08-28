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
const appCss = read('styles/app.css');
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
// index.css only carries the legacy manifest entry; styles/app.css holds the runtime import loaded via RouteStyleGate.
// Strip /* */ blocks so a commented-out import cannot satisfy the runtime guardrail.
const appCssActive = appCss.replace(/\/\*[\s\S]*?\*\//g, '');
assertIncludes(appCssActive, "@import './add-shoes-profile-alignment.css';", 'runtime Add Shoes Profile redesign import in styles/app.css');

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
  'grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr);',
  '#root .add-shoes-profile-redesign .add-shoes-editorial-hero-main',
  '#root .add-shoes-profile-redesign .add-shoes-editorial-hero-rail',
  '#root .add-shoes-profile-redesign .add-shoes-catalog-workspace',
  'grid-template-columns: minmax(0, 1.9fr) minmax(320px, 1fr);',
  '#root .add-shoes-profile-redesign .add-shoes-browser-panel.add-shoes-stage',
  '#root .add-shoes-profile-redesign .add-shoes-catalog-step',
  '#root .add-shoes-profile-redesign .add-shoes-setup-panel',
  '#root .add-shoes-profile-redesign .add-shoes-brand-deck-feature',
  '#root .add-shoes-profile-redesign .add-shoes-selected-summary',
  '#root .add-shoes-profile-redesign .add-shoes-model-board .add-shoes-model-grid',
  'grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));',
  'grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));',
  'font-variant-numeric: tabular-nums;',
  '#root .add-shoes-profile-redesign .add-shoes-setup-payload-shell',
  'body:is(.theme-midnight, .theme-high-contrast) #root .add-shoes-profile-redesign',
  '@media (max-width: 1180px)',
  '@media (max-width: 980px)',
  '@media (max-width: 760px)',
  '@media (prefers-reduced-motion: reduce)',
  'grid-template-columns: minmax(0, 1fr);',
].forEach((snippet) => assertIncludes(redesignCss, snippet, 'Add Shoes Profile CSS'));

/* Layout-lock contract (DV-2026-08-28-002): the stage is a single-column flow
   card. Track-spanning stage grids collapsed the catalog steps into ~60px
   tracks after DV-2026-08-23-171 removed the step-card spans from the JSX. */
const stageRuleMatch = redesignCss.match(
  /#root \.add-shoes-profile-redesign \.add-shoes-browser-panel\.add-shoes-stage\s*\{[\s\S]*?\n\}/,
);
assert.ok(stageRuleMatch, 'Add Shoes stage rule block should exist.');
assert.ok(
  !redesignCss.includes('repeat(16'),
  'Add Shoes stage must stay a single-column flow card anywhere in this stylesheet; a 16-track stage grid without step spans collapses the catalog steps.',
);
assert.ok(
  !redesignCss.includes('grid-column: span'),
  'Add Shoes Profile layout must not depend on grid-column track spans; span rules silently orphaned the catalog steps once their JSX hooks were removed.',
);

assert.doesNotMatch(
  redesignCss,
  /font-size:\s*[^;]*vw/i,
  'Add Shoes Profile redesign must not scale typography directly with viewport width.',
);

console.log('[PASS] Add Shoes profile redesign guardrails passed.');
