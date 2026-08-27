import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');
const cardStart = dashboardSource.indexOf('className="admin-shoe-catalog-browser__series-card is-published"');
const cardEnd = dashboardSource.indexOf('</button>', cardStart);
assert.ok(cardStart >= 0 && cardEnd > cardStart, 'Published series card should remain rendered.');

const publishedSeriesCard = dashboardSource.slice(cardStart, cardEnd);

assert.doesNotMatch(
  publishedSeriesCard,
  /catalog_image_manage|admin-shoe-catalog-browser__series-action|openCatalogImagePicker/,
  'Series cards should not expose the maintenance-image action or open its modal.',
);
assert.match(publishedSeriesCard, /admin-shoe-catalog-browser__series-art/);
assert.match(publishedSeriesCard, /admin-shoe-catalog-browser__series-name/);
assert.match(publishedSeriesCard, /admin-shoe-catalog-browser__series-type/);

console.log('[PASS] Admin series cards omit the maintenance-image action.');
