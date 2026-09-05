import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const cardSource = readFileSync(path.join(here, "../../../components/CatalogLongPressCard.jsx"), 'utf8');
const monitoringCss = readFileSync(path.join(here, "../../../styles/admin-monitoring-dashboard.css"), 'utf8');
const enSource = readFileSync(path.join(here, "../../../i18n/locales/en/components.js"), 'utf8');
const zhSource = readFileSync(path.join(here, "../../../i18n/locales/zh-CN/components.js"), 'utf8');

assert.match(
  dashboardSource,
  /const data = await apiJson\('\/api\/shoe-catalog'\);[\s\S]*?const brands = Array\.isArray\(data\) \? data : data\?\.brands;[\s\S]*?setCatalogInventory\(Array\.isArray\(brands\) \? brands : \[\]\)/,
  'Admin catalog loading should preserve IDs from either array or wrapped API responses.',
);
assert.match(
  dashboardSource,
  /const \[catalogDeleteMode, setCatalogDeleteMode\] = useState\(false\)/,
  'The admin catalog should track the explicit delete mode toggle.',
);
assert.match(
  dashboardSource,
  /const \[catalogBrandDeleteMode, setCatalogBrandDeleteMode\] = useState\(false\)/,
  'The admin catalog should track a separate brand delete mode toggle.',
);
assert.match(
  dashboardSource,
  /<CatalogLongPressCard[\s\S]*?deleteMode=\{catalogDeleteMode\}[\s\S]*?admin-shoe-catalog-browser__series-card is-published/,
  'Published series cards should receive the explicit delete mode.',
);
assert.match(
  dashboardSource,
  /<CatalogLongPressCard[\s\S]*?deleteMode=\{catalogBrandDeleteMode\}[\s\S]*?admin-shoe-catalog-browser__brand/,
  'Brand cards should receive the explicit delete mode.',
);
assert.match(
  dashboardSource,
  /const \[catalogHiddenBrandKeys, setCatalogHiddenBrandKeys\] = useState\(/,
  'Brand delete mode should track fallback brands hidden locally when they have no database ID.',
);
assert.match(
  dashboardSource,
  /const deleteTarget = \{ kind: 'brand', id: brand\.id \|\| null, brand: brand\.brand/,
  'Every visible brand card should receive a delete target, including built-in fallback brands.',
);
assert.match(
  dashboardSource,
  /deleteMode=\{catalogBrandDeleteMode\}/,
  'Brand delete mode should reveal the delete action for every brand card.',
);
assert.match(
  dashboardSource,
  /admin-shoe-catalog-browser__brand--delete-mode[\s\S]*?setCatalogBrandDeleteMode\(value => !value\)/,
  'The brand delete card should toggle explicit delete mode.',
);
assert.match(
  dashboardSource,
  /admin-shoe-catalog-browser__series-card--delete-mode[\s\S]*?setCatalogDeleteMode\(value => !value\)/,
  'The delete card should toggle explicit delete mode.',
);
assert.match(
  dashboardSource,
  /catalog_browser_delete_mode/,
  'The delete card should use localized copy.',
);
assert.match(
  cardSource,
  /deleteMode = false/,
  'Catalog cards should accept the explicit delete mode state.',
);
assert.match(
  cardSource,
  /const isDeleteReady = Boolean\(deleteMode \|\|/,
  'Explicit delete mode should reveal the existing upper-right delete action.',
);
assert.match(
  cardSource,
  /admin-shoe-catalog-browser__delete-action\$\{deleteMode \? ' is-visible' : ''\}/,
  'Explicit delete mode should mark each delete button visible directly.',
);
assert.match(
  cardSource,
  /\{\(target \|\| deleteMode\) && \(/,
  'Delete mode should render a visible control even for built-in fallback cards.',
);
assert.match(
  cardSource,
  /if \(!deleteTarget \|\| busy\) return;/,
  'Delete buttons should remain actionable for fallback targets without a database ID.',
);
assert.match(
  cardSource,
  /disabled=\{busy\}/,
  'Delete controls should only be disabled while a deletion request is in flight.',
);
assert.doesNotMatch(
  cardSource,
  /disabled=\{busy \|\| !target\?\.id\}/,
  'Fallback delete controls must not be disabled solely because they lack a database ID.',
);
assert.match(
  dashboardSource,
  /const deleteTarget = \{ kind: 'model', id: model\.id \|\| null, brand: catalogBrowserBrandEntry\.brand, model: model\.model \}/,
  'Every visible series card should receive a delete target, including built-in fallback cards.',
);
assert.match(
  dashboardSource,
  /catalogHiddenSeriesKeys/,
  'Fallback deletions should be persisted locally so deleted cards stay hidden after refresh.',
);
assert.match(
  dashboardSource,
  /catalogHiddenBrandKeys[\s\S]*setCatalogHiddenBrandKeys/,
  'Fallback brand deletions should be persisted locally so deleted cards stay hidden after refresh.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__series-card--delete-mode\s*\{[\s\S]*?text-align:\s*center/,
  'The delete-mode card should match the catalog card grid language.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__brand--delete-mode\s*\{[\s\S]*?text-align:\s*center/,
  'The brand delete-mode card should match the brand card grid language.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__card-shell\.is-delete-ready \.admin-shoe-catalog-browser__delete-action/,
  'Delete buttons should remain positioned by the card shell in delete mode.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__delete-action\.is-visible\s*\{[\s\S]*?pointer-events:\s*auto/,
  'Explicit delete mode should make the upper-right action clickable.',
);
assert.match(enSource, /"catalog_browser_delete_mode":\s*"Delete series"/);
assert.match(zhSource, /"catalog_browser_delete_mode":\s*"删除系列"/);
assert.match(enSource, /"catalog_browser_brand_delete_mode":\s*"Delete brand"/);
assert.match(zhSource, /"catalog_browser_brand_delete_mode":\s*"删除品牌"/);
assert.match(
  dashboardSource,
  /catalog_brand_delete_modal_title[\s\S]*catalog_brand_delete_modal_copy/,
  'Brand deletion should reuse the designed confirmation modal with brand-specific copy.',
);
assert.match(
  dashboardSource,
  /footerAction=\{\([\s\S]*?admin-shoe-catalog-browser__specific-action[\s\S]*?catalog_browser_add_specific[\s\S]*?openCatalogSeries\(\{ brand: catalogBrowserBrandEntry\.brand \}\)/,
  'Every catalog series card should expose a bottom-left action for adding a concrete shoe.',
);
assert.match(
  cardSource,
  /footerAction = null/,
  'Catalog cards should support a sibling footer action without nesting another button.',
);
assert.match(
  cardSource,
  /data-catalog-card-action/,
  'Catalog card footer actions should be excluded from long-press gesture handling.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__specific-action\s*\{[\s\S]*?position:\s*absolute[\s\S]*?bottom:\s*12px[\s\S]*?left:\s*14px/,
  'The concrete-shoe action should sit in the bottom-left corner of the series card.',
);
assert.match(enSource, /"catalog_browser_add_specific":\s*"Add specific shoe"/);
assert.match(zhSource, /"catalog_browser_add_specific":\s*"添加具体鞋款"/);

console.log('[PASS] Admin catalog delete mode is wired to the series card grid.');
