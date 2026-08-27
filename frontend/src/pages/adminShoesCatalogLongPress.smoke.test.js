import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');
const cardSource = readFileSync(path.join(here, '../components/CatalogLongPressCard.jsx'), 'utf8');
const gestureSource = readFileSync(path.join(here, '../utils/catalogLongPress.js'), 'utf8');
const monitoringCss = readFileSync(path.join(here, '../styles/admin-monitoring-dashboard.css'), 'utf8');
const zhComponents = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');
const enComponents = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const catalogRowStart = dashboardSource.indexOf('function CatalogRowComponent');
const catalogRowEnd = dashboardSource.indexOf('function CourseMapQueueRowComponent');
const catalogRowSource = dashboardSource.slice(catalogRowStart, catalogRowEnd);

assert.match(
  gestureSource,
  /const CATALOG_LONG_PRESS_MS = 3000/,
  'Catalog deletion should use the requested three-second long-press threshold.',
);
assert.match(
  gestureSource,
  /setTimeout\([\s\S]*CATALOG_LONG_PRESS_MS/,
  'Catalog cards should start a tracked long-press timer.',
);
assert.match(
  gestureSource,
  /deltaY <= -CATALOG_SWIPE_THRESHOLD_PX[\s\S]*onDeleteRef/,
  'An upward swipe should request deletion after the long press.',
);
assert.match(
  gestureSource,
  /deltaY >= CATALOG_SWIPE_THRESHOLD_PX[\s\S]*setReadyKey\(''\)/,
  'A downward swipe should dismiss the delete action.',
);
assert.match(
  cardSource,
  /useCatalogLongPress/,
  'Catalog cards should use the shared long-press gesture hook.',
);
assert.match(
  cardSource,
  /admin-shoe-catalog-browser__delete-action/,
  'Long-press-ready catalog cards should render a dedicated delete action.',
);
assert.match(
  cardSource,
  /onRequestDelete/,
  'Catalog delete actions should be able to open the designed confirmation modal.',
);
assert.match(
  cardSource,
  /if \(onRequestDelete\)\s*\{[\s\S]*?onRequestDelete\(deleteTarget, onDelete\)/,
  'The model delete button should delegate confirmation to the dashboard modal.',
);
assert.match(
  dashboardSource,
  /<CatalogLongPressCard/,
  'The dashboard should wrap catalog cards with the long-press behavior.',
);
assert.match(
  dashboardSource,
  /<CatalogLongPressCard[\s\S]*?deleteLabel=\{t\('dashboard\.btn_delete_catalog_model'\)\}[\s\S]*?onRequestDelete=\{requestCatalogDelete\}/,
  'Model delete actions should open the confirmation modal instead of a native prompt.',
);
assert.match(
  dashboardSource,
  /const \[catalogDeleteAction, setCatalogDeleteAction\] = useState\(null\)/,
  'The dashboard should retain the requested model delete action until confirmation.',
);
assert.match(
  dashboardSource,
  /if \(catalogDeleteAction\) \{[\s\S]*?await catalogDeleteAction\(catalogDeleteTarget\)/,
  'The confirmation modal should execute the requested model delete action after approval.',
);
assert.match(
  dashboardSource,
  /apiJson\(`\/api\/shoe-catalog\/admin\/brands\//,
  'Brand catalog cards should route persisted deletes through the admin API.',
);
assert.match(
  dashboardSource,
  /apiJson\(`\/api\/shoe-catalog\/admin\/models\//,
  'Model catalog cards should route persisted deletes through the admin API.',
);
assert.match(
  dashboardSource,
  /catalogBrandFormOpen[\s\S]*catalogBrandZh[\s\S]*catalogBrandLogoUrl/,
  'The add-brand flow should keep localized name and logo fields separate from the series form.',
);
assert.match(
  dashboardSource,
  /\/api\/shoe-catalog\/admin\/brands[\s\S]*brandZh[\s\S]*logoUrl/,
  'The add-brand modal should submit the localized brand name and logo reference.',
);
assert.match(
  dashboardSource,
  /catalog_brand_logo[\s\S]*catalog_brand_name_zh/,
  'The add-brand modal should expose logo and optional Chinese-name inputs.',
);
assert.match(
  dashboardSource,
  /const CATALOG_ROW_HEIGHT = 300[\s\S]*?rowHeight=\{CATALOG_ROW_HEIGHT\}[\s\S]*?CATALOG_ROW_HEIGHT \* 3/,
  'Virtualized catalog rows should reserve enough height for the complete card content.',
);
assert.match(
  catalogRowSource,
  /admin-shoe-card-actions[\s\S]*?admin-shoe-card-action[\s\S]*?onOpenImage\(item\)[\s\S]*?onDelete\(item\)/,
  'Published catalog cards should expose edit and delete actions in a shared action overlay.',
);
assert.doesNotMatch(
  catalogRowSource,
  /btn-secondary btn-inline-sm[\s\S]*?catalog_image_manage/,
  'Published catalog cards should no longer render the bottom image-maintenance button.',
);
assert.match(
  dashboardSource,
  /const deleteCatalogModel = useCallback\([\s\S]*?\/api\/shoe-catalog\/admin\/models\//,
  'Published catalog deletion should reuse the persisted admin model-delete API.',
);
assert.match(
  dashboardSource,
  /onDelete: deleteCatalogModel[\s\S]*?catalogRowProps/,
  'The published catalog row props should provide the model-delete callback.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-card-actions\s*\{[\s\S]*?position:\s*absolute[\s\S]*?top:\s*10px[\s\S]*?right:\s*10px/,
  'Published card actions should be positioned in the upper-right corner.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-card:hover \.admin-shoe-card-actions,[\s\S]*?\.admin-command-page \.admin-shoe-card:focus-within \.admin-shoe-card-actions/,
  'Published card actions should appear on hover and keyboard focus.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-card-action--danger\s*\{/,
  'Published card deletion should retain a distinct danger action treatment.',
);
assert.match(
  dashboardSource,
  /const \[catalogDeleteTarget, setCatalogDeleteTarget\] = useState\(null\)/,
  'The published-card delete action should open a dedicated confirmation modal target.',
);
assert.doesNotMatch(
  dashboardSource,
  /const deleteCatalogModel = useCallback\([\s\S]*?window\.confirm/,
  'The published-card delete action should not rely on the browser confirmation prompt.',
);
assert.match(
  dashboardSource,
  /isOpen=\{Boolean\(catalogDeleteTarget\)\}[\s\S]*?catalog-delete-modal[\s\S]*?confirmCatalogModelDelete/,
  'The published-card delete action should render a designed confirmation modal.',
);
assert.match(
  monitoringCss,
  /\.admin-catalog-delete-modal__target\s*\{[\s\S]*?border-radius:\s*14px[\s\S]*?background:/,
  'The delete modal should visually group the catalog shoe identity.',
);
assert.match(
  zhComponents,
  /"catalog_delete_modal_title":\s*"删除这条目录鞋款？"[\s\S]*?"catalog_delete_modal_confirm":\s*"删除"/,
  'The delete modal should have Chinese title and confirmation copy.',
);
assert.match(
  enComponents,
  /"catalog_delete_modal_title":\s*"Delete this catalog shoe\?"[\s\S]*?"catalog_delete_modal_confirm":\s*"Delete"/,
  'The delete modal should have English title and confirmation copy.',
);
assert.match(
  dashboardSource,
  /const \[catalogRefreshing, setCatalogRefreshing\] = useState\(false\)/,
  'The catalog refresh action should expose a guarded loading state.',
);
assert.match(
  dashboardSource,
  /const refreshCatalog = useCallback\([\s\S]*?Promise\.all\(\[loadCatalogInventory\(\), loadCatalogImageAssets\(\)\]\)/,
  'Catalog refresh should reload both inventory and image assets used by the cards.',
);
assert.match(
  dashboardSource,
  /onClick=\{refreshCatalog\}[\s\S]*?disabled=\{catalogRefreshing\}/,
  'The catalog refresh button should use the combined refresh handler and prevent duplicate requests.',
);
assert.match(
  zhComponents,
  /"catalog_refreshing":\s*"刷新中…"[\s\S]*?"catalog_refresh_complete":\s*"目录已刷新。"/,
  'The refresh action should provide Chinese loading and completion feedback.',
);
assert.match(
  enComponents,
  /"catalog_refreshing":\s*"Refreshing…"[\s\S]*?"catalog_refresh_complete":\s*"Catalog refreshed\."/,
  'The refresh action should provide English loading and completion feedback.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__brand-rail\s*\{[^}]*grid-auto-rows:\s*58px[^}]*max-height:\s*198px/,
  'The brand rail should show exactly three complete rows before scrolling.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__brand-rail\s*\{[^}]*overflow-y:\s*auto[^}]*scrollbar-width:\s*none/,
  'The brand rail should retain wheel scrolling without showing a scrollbar strip.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__brand-rail::-webkit-scrollbar\s*\{[^}]*display:\s*none/,
  'The brand rail scrollbar should stay hidden in WebKit browsers.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__brand\s*\{[^}]*box-sizing:\s*border-box[^}]*border:\s*1px solid var\(--admin-profile-line\)/,
  'Brand buttons should keep both side borders inside their grid cells.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__card-shell\s*\{[^}]*overflow:\s*visible/,
  'The long-press wrapper should not clip the catalog button border.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__delete-action\s*\{[^}]*top:\s*8px[^}]*right:\s*8px[^}]*transform:\s*translateY\(-8px\) scale\(0\.94\)/,
  'Catalog delete actions should begin at the upper-right of the card.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-shoe-catalog-browser__card-shell\.is-delete-ready \.admin-shoe-catalog-browser__delete-action\s*\{[^}]*transform:\s*translateY\(0\) scale\(1\)/,
  'A completed long press should reveal the upper-right delete action.',
);
