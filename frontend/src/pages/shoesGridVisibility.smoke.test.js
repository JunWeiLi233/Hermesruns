import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const styles = read('src/styles/style.css');
const shoesPage = read('src/pages/Shoes.jsx');
const addShoesPage = read('src/pages/AddShoes.jsx');

const assertIncludes = (source, needle, label) => {
  if (!source.includes(needle)) {
    throw new Error(`${label} missing: ${needle}`);
  }
};

const repairStart = styles.indexOf('/* Runtime Shoes selector bridge');
if (repairStart < 0) {
  throw new Error('Runtime Shoes selector bridge block is missing.');
}

const repairBlock = styles.slice(repairStart);

[
  'Runtime Shoes selector bridge',
  'Runtime Shoes contrast hardening',
  '.shoes-dashboard-page',
  '.add-shoes-page',
  'body:is(.theme-midnight, .theme-high-contrast)',
  'body:is(.theme-light, .theme-high-contrast-light) .shoes-dashboard-page',
  'body.theme-light .shoes-dashboard-page .shoe-rotation-signal-copy h2',
  'body.theme-light .runner-shell-page.shoes-dashboard-page .shoe-rotation-signal.shoe-rotation-signal .shoe-rotation-signal-copy h2',
  'body.theme-light .runner-shell-page.shoes-dashboard-page .shoe-rotation-signal.shoe-rotation-signal .shoe-inventory-panel-kicker',
  '.shoe-inventory-card-copy h2',
  '.shoe-inventory-card-meta',
  '.shoe-inventory-card-retirement-text',
  '.shoe-inventory-search input::placeholder',
  '.shoe-rotation-signal-detail-item',
  '.shoe-rotation-signal-copy h2',
  '.shoe-health-summary-label',
  '.shoe-inventory-card-type-badge',
  '.runner-shell-footer a',
  '--shoe-readable-ink',
  '--shoe-readable-muted',
  '--shoe-readable-faint',
  '.add-shoes-brand-expand-grid',
  '.add-shoes-model-empty',
  '.add-shoes-field .modal-label',
  '.add-shoes-search-row input::placeholder',
  '--shoe-grid-ink',
  '--shoe-grid-muted',
].forEach((selector) => assertIncludes(repairBlock, selector, 'visibility repair selector'));

[
  'shoe-inventory-grid',
  'shoe-inventory-card',
  'shoe-inventory-card-metrics',
  'shoe-inventory-card-side',
  'shoe-inventory-manage-grid',
  'shoe-rotation-signal',
].forEach((className) => assertIncludes(shoesPage, className, 'Shoes page class hook'));

[
  'add-shoes-brand-deck-grid',
  'add-shoes-brand-expand-grid',
  'add-shoes-model-grid',
  'add-shoes-model-empty',
  'add-shoes-field',
].forEach((className) => assertIncludes(addShoesPage, className, 'Add Shoes page class hook'));

console.log('shoesGridVisibility smoke test passed');
