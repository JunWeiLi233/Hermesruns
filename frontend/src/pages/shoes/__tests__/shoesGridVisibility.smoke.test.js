import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../../../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

const styles = [
  read('./src/styles/style.generated.css'),
  read('./src/styles/_split/shoes.css'),
].join('\n');
const lightThemeStyles = read('./src/styles/_split/light-theme-overrides.css');
const liquidGlassStyles = read('./src/styles/all-pages-liquid-glass.css');
const gridCardsStyles = read('./src/styles/grid-cards-white.css');
const shoesPage = read('./src/pages/shoes/Shoes.jsx');
const addShoesPage = read('./src/pages/shoes/AddShoes.jsx');

const assertIncludes = (source, needle, label) => {
  if (!source.includes(needle)) {
    throw new Error(`${label} missing: ${needle}`);
  }
};

const assertExcludes = (source, needle, label) => {
  if (source.includes(needle)) {
    throw new Error(`${label} should not include: ${needle}`);
  }
};

const assertMatches = (source, pattern, label) => {
  if (!pattern.test(source)) {
    throw new Error(`${label} missing: ${pattern}`);
  }
};

assertMatches(
  styles,
  /\.shoes-profile-workspace \.shoe-inventory-filterbar\s*\{\s*background: #f1f2f2;\s*\}/,
  'light-grey Shoes inventory filter grid surface'
);

[
  '.shoes-dashboard-page',
  '.add-shoes-page',
  'body:is(.theme-midnight, .theme-high-contrast)',
  'body.theme-light .shoe-rotation-signal-copy h2',
  '.shoe-inventory-card-copy h2',
  '.shoe-inventory-card-meta',
  '.shoe-inventory-card-retirement-text',
  '.shoe-inventory-search input::placeholder',
  '.shoe-rotation-signal-detail-item',
  '.shoe-rotation-signal-copy h2',
  '.shoe-health-summary-label',
  '.shoe-inventory-card-type-badge',
  '.shoes-profile-workspace',
  '.shoe-inventory-summary-strip',
  '.shoe-inventory-workspace-head',
  '.shoe-inventory-toolbar',
  '.shoes-dashboard-page .shoe-inventory-grid',
  '.runner-shell-footer a',
  '.add-shoes-brand-expand-grid',
  '.add-shoes-model-empty',
  '.add-shoes-field .modal-label',
  '.add-shoes-search-row input::placeholder',
].forEach((selector) => assertIncludes(styles, selector, 'visibility selector'));

[
  'shoe-inventory-grid',
  'shoe-inventory-card',
  'shoe-inventory-card-metrics',
  'shoe-inventory-card-side',
  'shoe-inventory-manage-grid',
  'shoes-profile-workspace',
  'shoe-inventory-summary-strip',
  'shoe-inventory-workspace-head',
  'shoe-inventory-toolbar',
].forEach((className) => assertIncludes(shoesPage, className, 'Shoes page class hook'));

assertIncludes(
  liquidGlassStyles,
  '.runner-shell-page.shoes-dashboard-page .shoe-inventory-card :is(',
  'Shoes nested-card liquid-glass reset'
);
assertIncludes(
  liquidGlassStyles,
  '  .shoe-inventory-card-subtitle,\n  .shoe-inventory-card-badges,\n  .shoe-inventory-card-metrics,\n  .shoe-inventory-card-metric,\n  .shoe-inventory-card-metric-value,',
  'Shoes inner strip liquid-glass reset'
);
assertMatches(
  liquidGlassStyles,
  /\.runner-shell-page\.shoes-dashboard-page :is\(\.shoe-inventory-card-subtitle, \.shoe-inventory-card-metrics, \.shoe-inventory-card-metric, \.shoe-inventory-card-metric-value, \.shoe-inventory-card-progress\) \{\s*background: transparent !important;\s*\}/,
  'Shoes pale strip background reset'
);
assertMatches(
  liquidGlassStyles,
  /\.runner-shell-page\.shoes-dashboard-page \.shoe-inventory-manage-group > \.shoe-inventory-panel-kicker \{\s*background: transparent !important;\s*border-color: transparent !important;\s*box-shadow: none !important;/,
  'Shoes filter label strip reset'
);
assertMatches(
  liquidGlassStyles,
  /\.runner-shell-page\.shoes-dashboard-page \.shoe-rotation-signal-copy > \.shoe-inventory-panel-kicker \{\s*background: transparent !important;\s*border-color: transparent !important;\s*box-shadow: none !important;/,
  'Shoes rotation label strip reset'
);
assertExcludes(
  gridCardsStyles,
  '.shoes-dashboard-page.shoes-atelier-redesign {',
  'Shoes light-theme page background should remain the original warm surface'
);
assertMatches(
  gridCardsStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoes-dashboard-page\.shoes-atelier-redesign \.shoe-inventory-stage\s*\{[\s\S]*background: #fff !important;[\s\S]*background-image: none !important;[\s\S]*box-shadow: none !important;/,
  'Shoes light-theme stage should be solid white without a panel gradient'
);
assertMatches(
  gridCardsStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoes-dashboard-page\.shoes-atelier-redesign \.shoe-inventory-workspace-copy > \.shoe-inventory-panel-kicker\s*\{[\s\S]*background: transparent !important;[\s\S]*border-color: transparent !important;[\s\S]*box-shadow: none !important;/,
  'Shoes workspace kicker should not render a panel strip behind the text'
);
assertMatches(
  gridCardsStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoes-dashboard-page\.shoes-atelier-redesign \.shoe-inventory-search\s*\{[\s\S]*border: 0 !important;[\s\S]*box-shadow: none !important;/,
  'Shoes search bar should not render a border or inset outline'
);
assertMatches(
  gridCardsStyles,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.shoes-dashboard-page\.shoes-atelier-redesign \.shoe-inventory-search input:focus-visible\s*\{[\s\S]*border: 0 !important;[\s\S]*outline: none !important;[\s\S]*box-shadow: none !important;/,
  'Shoes focused search input should not render the red focus outline'
);
assertMatches(
  styles,
  /#root \.shoes-atelier-redesign \.shoe-rotation-signal-highlight\s*\{\s*background: #f3f4f4 !important;\s*\}/,
  'Shoes recommendation highlight light-grey surface'
);
assertMatches(
  lightThemeStyles,
  /body\.theme-light \.shoes-profile-workspace \.shoe-inventory-card-progress \{\s*background: transparent;\s*\}/,
  'light theme profile shoe progress strip reset'
);
assertMatches(
  styles,
  /\.shoes-profile-workspace \.shoe-rotation-signal\.is-recommend \.shoe-rotation-signal-meta \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/,
  'compact fallback recommendation metric row'
);
assertMatches(
  styles,
  /@media \(max-width: 760px\)[\s\S]*?\.shoes-profile-workspace \.shoe-rotation-signal\.is-recommend \.shoe-rotation-signal-meta \{\s*grid-template-columns: minmax\(0, 1fr\);/,
  'stacked fallback recommendation metrics on mobile'
);
assertIncludes(styles, 'grid-template-columns: repeat(2, minmax(0, 1fr)) !important;', 'stable Shoes desktop grid');
assertExcludes(shoesPage, 'isInventoryCollapsed', 'duplicate inventory collapse state');
assertExcludes(shoesPage, 'Collapse running shoes inventory', 'hardcoded inventory accessibility copy');
assertExcludes(shoesPage, 'Expand running shoes inventory', 'hardcoded inventory accessibility copy');
assertExcludes(
  shoesPage,
  "<span className=\"shoe-inventory-panel-kicker\">{t('shoes.stitch_surface_label')}</span>",
  'Shoes inventory header should not render the redundant panel kicker',
);

[
  'add-shoes-brand-deck-grid',
  'add-shoes-brand-expand-grid',
  'add-shoes-model-grid',
  'add-shoes-model-empty',
  'add-shoes-field',
].forEach((className) => assertIncludes(addShoesPage, className, 'Add Shoes page class hook'));

console.log('shoesGridVisibility smoke test passed');
