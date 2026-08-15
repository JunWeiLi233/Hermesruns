import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const styles = [
  read('src/styles/style.generated.css'),
  read('src/styles/_split/shoes.css'),
].join('\n');
const lightThemeStyles = read('src/styles/_split/light-theme-overrides.css');
const liquidGlassStyles = read('src/styles/all-pages-liquid-glass.css');
const shoesPage = read('src/pages/Shoes.jsx');
const addShoesPage = read('src/pages/AddShoes.jsx');

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
  'shoe-rotation-signal',
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

[
  'add-shoes-brand-deck-grid',
  'add-shoes-brand-expand-grid',
  'add-shoes-model-grid',
  'add-shoes-model-empty',
  'add-shoes-field',
].forEach((className) => assertIncludes(addShoesPage, className, 'Add Shoes page class hook'));

console.log('shoesGridVisibility smoke test passed');
