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
assertIncludes(addShoesSource, 'className="add-shoes-brand-deck-card is-active"', 'Add Shoes featured brand should share the compact brand-card class');
assertIncludes(addShoesSource, '<ShoeBrandLogo brand={featuredBrand.brand} fallbackEmoji={featuredBrand.logo} />', 'Add Shoes featured brand should use the normal logo tile');
assert.doesNotMatch(
  addShoesSource,
  /add-shoes-brand-deck-feature/,
  'Add Shoes should not render a separate oversized featured brand card.',
);
assert.match(
  addShoesSource,
  /<div className="add-shoes-brand-deck-grid">[\s\S]*?featuredBrand \? \([\s\S]*?className="add-shoes-brand-deck-card is-active"/,
  'Add Shoes featured brand should be the first item in the shared brand-card grid.',
);

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
  /^#root \.add-shoes-profile-redesign \.add-shoes-canvas\s*\{[^}]*width:\s*calc\(100% - 48px\);[^}]*max-width:\s*none;[^}]*margin-inline:\s*auto;[^}]*padding:\s*24px 0 52px/m,
  'Add Shoes canvas should use the full available width while keeping equal side margins.',
);
assert.match(
  redesignCss,
  /^#root \.add-shoes-profile-redesign\s*\{[^}]*background:\s*#f1f2f2 !important;[^}]*background-image:\s*none !important;/m,
  'Add Shoes light page surface should use a flat light-grey background.',
);
assert.match(
  redesignCss,
  /@media \(min-width:\s*1100px\) \{[\s\S]*?#root \.add-shoes-profile-redesign \.add-shoes-canvas\s*\{[^}]*width:\s*calc\(100% - 32px\) !important;[^}]*max-width:\s*none !important;/m,
  'Add Shoes should override the Profile shell cap on wide screens while preserving its side inset.',
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
  'grid-template-columns: minmax(0, 1fr);',
  '#root .add-shoes-profile-redesign .add-shoes-browser-panel.add-shoes-stage',
  '#root .add-shoes-profile-redesign .add-shoes-catalog-step',
  '#root .add-shoes-profile-redesign .add-shoes-setup-panel',
  '#root .add-shoes-profile-redesign .add-shoes-brand-deck-card.is-active',
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

assert.match(
  redesignCss,
  /^#root \.add-shoes-profile-redesign \.add-shoes-catalog-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/m,
  'Add Shoes Step 3 should flow below the full catalog stage at every width.',
);

const brandGridStart = addShoesSource.indexOf('<div className="add-shoes-brand-deck-grid">');
const expandButtonStart = addShoesSource.indexOf("className={cx('add-shoes-brand-expand-btn', 'add-shoes-brand-expand-card'");
const secondaryBrandMapStart = addShoesSource.indexOf('{secondaryBrands.map((brand) => {');
const expandGridStart = addShoesSource.indexOf('id="add-shoes-extra-brands" className="add-shoes-brand-expand-grid"');
assert.ok(
  brandGridStart >= 0 && secondaryBrandMapStart > brandGridStart && expandButtonStart > secondaryBrandMapStart,
  'The Add Shoes brand disclosure should follow the regular cards beside the Brooks card.',
);
assert.ok(
  expandGridStart > brandGridStart,
  'Expanded Add Shoes brand cards should be nested inside the primary brand grid.',
);
assertIncludes(addShoesSource, 'aria-controls="add-shoes-extra-brands"', 'Add Shoes brand disclosure target');
assertIncludes(addShoesSource, 'add-shoes-brand-expand-card', 'Add Shoes brand disclosure card hook');
assert.match(
  redesignCss,
  /#root \.add-shoes-profile-redesign \.add-shoes-brand-deck-grid\s*>\s*\.add-shoes-brand-expand-card\s*\{[^}]*min-height:\s*138px;[^}]*border-radius:\s*18px;/m,
  'Add Shoes brand disclosure should use the same card treatment as the surrounding brand grid.',
);
assert.match(
  redesignCss,
  /#root \.add-shoes-profile-redesign \.add-shoes-catalog-workspace\s*\{[^}]*background:\s*transparent !important;[^}]*border:\s*0 !important;[^}]*box-shadow:\s*none !important;/m,
  'Add Shoes workspace should not render one background card behind the separate steps.',
);

assert.match(
  addShoesSource,
  /function handleCategoryFilterPick\(categoryKey\) \{\s*setBrowserCategory\(categoryKey\);\s*setBrowserType\('all'\);\s*\}/,
  'Selecting an Add Shoes category should clear any selected type filter.',
);
assert.match(
  addShoesSource,
  /function handleTypeFilterPick\(typeKey\) \{\s*setBrowserType\(typeKey\);\s*setBrowserCategory\(null\);\s*\}/,
  'Selecting an Add Shoes type should clear any selected category filter.',
);

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
  /linear-gradient\(90deg,\s*rgba\(33, 28, 24, 0\.04\) 1px, transparent 1px\)/,
  'Add Shoes should not render the decorative vertical grid line in the hero.',
);
assert.doesNotMatch(
  redesignCss,
  /linear-gradient\(0deg,\s*rgba\(33, 28, 24, 0\.032\) 1px, transparent 1px\)/,
  'Add Shoes should not render the decorative horizontal grid line in the hero.',
);
assert.doesNotMatch(
  redesignCss,
  /background-size:\s*34px 34px,\s*34px 34px,\s*auto\s*!important/,
  'Add Shoes should not retain the hero grid background sizing.',
);
assert.match(
  redesignCss,
  /\.runner-shell-page\.add-shoes-profile-redesign::before\s*\{[\s\S]*?content:\s*none\s*!important;/,
  'Add Shoes should disable the shared page grid layer.',
);
assert.match(
  redesignCss,
  /\.runner-shell-page\.add-shoes-profile-redesign \.runner-shell-canvas::before\s*\{[\s\S]*?content:\s*none\s*!important;/,
  'Add Shoes should disable the shared canvas grid layer.',
);

assert.doesNotMatch(
  redesignCss,
  /font-size:\s*[^;]*vw/i,
  'Add Shoes Profile redesign must not scale typography directly with viewport width.',
);

console.log('[PASS] Add Shoes profile redesign guardrails passed.');
