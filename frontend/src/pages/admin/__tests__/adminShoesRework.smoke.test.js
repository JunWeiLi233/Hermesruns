import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const modalSource = readFileSync(path.join(here, "../../../components/Modal.jsx"), 'utf8');
const addShoesSource = readFileSync(path.join(here, "../../shoes/AddShoes.jsx"), 'utf8');
const shoeCatalogSource = readFileSync(path.join(here, "../../shoes/ShoeCatalog.jsx"), 'utf8');
const catalogUtilitySource = readFileSync(path.join(here, "../../../utils/addShoeCatalog.js"), 'utf8');
const kineticCss = readFileSync(path.join(here, "../../../styles/admin-kinetic-editorial.css"), 'utf8');
const finalCss = readFileSync(path.join(here, "../../../styles/grid-cards-white.css"), 'utf8');
const monitoringCss = readFileSync(path.join(here, "../../../styles/admin-monitoring-dashboard.css"), 'utf8');
const enComponents = readFileSync(path.join(here, "../../../i18n/locales/en/components.js"), 'utf8');
const zhComponents = readFileSync(path.join(here, "../../../i18n/locales/zh-CN/components.js"), 'utf8');

// DV-2026-08-24-01 — the shoes tab is a catalog-only admin overview. User
// inventory remains available to the overview/admin APIs but must not be
// fetched or rendered by /dashboard/shoes.
assert.match(
  dashboardSource,
  /const catalogOnlyShoeOverview = activeTab === 'shoes';/,
  'The shoes route should explicitly opt into catalog-only rendering.',
);
assert.match(
  dashboardSource,
  /const bootstrapLoads = activeTab === 'shoes'\s*\n\s*\? \[\]\s*\n\s*: \[loadOverview\(\), loadQueues\(\), loadUsers\(\), loadCourseMaps\(\), loadShoes\(\), loadAudit\(\)\];/,
  'The catalog-only shoes route should not bootstrap user shoe inventory data.',
);
assert.match(
  dashboardSource,
  /activeTab === 'shoes'[\s\S]*?!catalogOnlyShoeOverview[\s\S]*?admin-shoe-rework__card--catalog[\s\S]*?catalog_title/,
  'The shoes route should keep the shared catalog card while gating user-inventory UI.',
);
assert.match(
  dashboardSource,
  /function normalizeShoeCatalogName\(value\)[\s\S]*?toLocaleLowerCase\(\)[\s\S]*?function getShoeCatalogIdentityKey\(brand, model\)/,
  'Catalog identity should normalize case and whitespace before deduplication.',
);
assert.match(
  dashboardSource,
  /catalogInventory\.reduce\(\(uniqueItems, brand\)[\s\S]*?uniqueItems\.has\(identityKey\)/,
  'Catalog items should keep one case-insensitive brand/model series entry.',
);
assert.match(
  dashboardSource,
  /mergeShoeCatalog\(shoeCatalog, \{ brands: catalogInventory \}\)/,
  'The admin catalog browser should use the same built-in and persisted catalog merge as the runner picker.',
);
assert.match(
  dashboardSource,
  /admin-shoe-catalog-browser__brand-rail[\s\S]*?admin-shoe-catalog-browser__series-grid[\s\S]*?openCatalog(?:Series|ImagePicker)\(/,
  'The admin shoes surface should expose brand-first series browsing with card-driven management actions.',
);
assert.match(
  dashboardSource,
  /function openCatalogBrandForm\(\)[\s\S]*?resetCatalogForm\(\)[\s\S]*?setCatalogFormOpen\(true\)/,
  'The brand add action should open a clean catalog form instead of carrying over a prior series.',
);
assert.match(
  dashboardSource,
  /admin-shoe-catalog-browser__brand--add[\s\S]*?openCatalogBrandForm(?:\(\))?/,
  'The brand rail should end with an add-brand card that opens the clean catalog form.',
);
assert.match(
  dashboardSource,
  /admin-shoe-catalog-browser__series-card--add[\s\S]*?openCatalogSeries\(\{\s*brand:\s*catalogBrowserBrandEntry\.brand\s*\}\)/,
  'The selected brand series grid should end with an add-series card that reuses the brand-prefilled catalog flow.',
);
assert.match(addShoesSource, /mergeShoeCatalog\(shoeCatalog/);
assert.match(shoeCatalogSource, /mergeShoeCatalog\(shoeCatalog/);
assert.match(catalogUtilitySource, /export function mergeShoeCatalog/);
for (const key of [
  'catalog_browser_title',
  'catalog_browser_copy',
  'catalog_browser_add',
  'catalog_browser_published',
  'catalog_published_title',
]) {
  assert.match(enComponents, new RegExp(`"${key}"`), `English catalog browser copy should include ${key}.`);
  assert.match(zhComponents, new RegExp(`"${key}"`), `Chinese catalog browser copy should include ${key}.`);
}
assert.doesNotMatch(
  dashboardSource,
  /admin-shoe-stitch-hero__stats|admin-shoe-stitch-health-card/,
  'The old hero stats block and floating health card should stay removed.',
);

assert.match(
  kineticCss,
  /\.admin-command-page \.admin-shoe-rework \.btn-secondary\.btn-inline-md\s*\{[^}]*border:\s*0 !important[^}]*!important/,
  'Shoes rework secondary buttons should use the soft-pill system with important overrides.',
);

assert.match(
  kineticCss,
  /\.admin-command-page \.admin-shoe-rework \.btn-primary\.btn-inline-md\s*\{[^}]*clip-path:\s*none !important[^}]*border-radius:\s*999px !important/,
  'Shoes rework primary actions should cancel the global cut-corner clip and render as true pills.',
);

assert.match(
  finalCss,
  /#root \.admin-command-page \.admin-command-route--shoes \.admin-shoe-rework__card--catalog \.admin-shoe-filter\s*\{[^}]*background:\s*#eef0f1 !important[^}]*background-image:\s*none !important/,
  'The dashboard/shoes catalog filters should use a final light-grey surface override.',
);
assert.match(
  finalCss,
  /#root \.admin-command-page \.admin-command-route--shoes \.admin-shoe-rework__card--catalog > \.action-bar > input\.admin-shoe-filter\s*\{[\s\S]*?border:\s*0 !important[\s\S]*?box-shadow:\s*none !important/,
  'The dashboard/shoes catalog search input should not render a visible border strip.',
);

// DV-2026-08-15-34 — shoe feature-card actions are compact pills (the old
// full-width 14px-radius grid buttons are gone), covering the delete button.
assert.match(
  kineticCss,
  /\.admin-command-page \.admin-shoe-rework \.admin-shoe-stitch-feature-card__actions > button\s*\{[^}]*width:\s*auto !important[^}]*border-radius:\s*999px !important/,
  'Shoe feature-card action buttons should be compact auto-width pills.',
);

assert.match(
  finalCss,
  /#root \.admin-command-page \.admin-command-route--shoes \.admin-shoe-stitch-stage\s*\{[\s\S]*?border:\s*0 !important[\s\S]*?background:\s*transparent !important[\s\S]*?box-shadow:\s*none !important[\s\S]*?backdrop-filter:\s*none !important/,
  'The shoes stage should remain a layout wrapper without a connecting background card.',
);

// The add-to-catalog form must use a viewport-safe modal surface instead of
// centering a tall card past the bottom edge of the admin viewport.
assert.match(
  dashboardSource,
  /<Modal\s+isOpen=\{catalogFormOpen\}[\s\S]*?portalToBody[\s\S]*?shellClassName="admin-catalog-modal-shell"/,
  'The add-to-catalog modal should render at the viewport root and use the viewport-safe admin treatment.',
);
assert.match(
  modalSource,
  /portalToBody\s*=\s*false[\s\S]*?createPortal\(content, document\.body\)/,
  'Modal should support opt-in body-level rendering for dialogs trapped by dashboard layout containers.',
);
const catalogModalShell = monitoringCss.match(/\.admin-catalog-modal-shell\s*\{([^}]*)\}/)?.[1];
assert.ok(catalogModalShell, 'Add-to-catalog modal should have a dedicated shell rule.');
assert.match(catalogModalShell, /align-items:\s*flex-start/);
const catalogModalCard = monitoringCss.match(/\.admin-catalog-modal-card\s*\{([^}]*)\}/)?.[1];
assert.ok(catalogModalCard, 'Add-to-catalog modal should have a dedicated card rule.');
assert.match(catalogModalCard, /max-height:\s*min\(calc\(100dvh - 32px\)/);
assert.match(monitoringCss, /\.admin-shoe-catalog-browser__brand-rail\s*\{/);
assert.match(monitoringCss, /\.admin-shoe-catalog-browser__brand--add\s*\{/);
assert.match(monitoringCss, /\.admin-shoe-catalog-browser__series-grid\s*\{/);
assert.match(monitoringCss, /\.admin-shoe-catalog-browser__series-card--add\s*\{/);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-command-route--shoes \.admin-shoe-rework__card--catalog > \.action-bar > \.btn-secondary\.btn-inline-md \+ \.btn-primary\.btn-inline-md\s*\{[^}]*margin-inline-start:\s*8px/,
  'The shoes catalog toolbar should keep visible spacing between its refresh and add actions.',
);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-command-route--shoes \.admin-shoe-rework__card--catalog > \.admin-shoe-catalog-browser\s*\{[^}]*margin-bottom:\s*24px/,
  'The shoes catalog browser should leave breathing room before the series directory below it.',
);
