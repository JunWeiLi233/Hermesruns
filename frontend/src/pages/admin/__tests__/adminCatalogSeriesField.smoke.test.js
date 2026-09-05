import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const enSource = readFileSync(path.join(here, "../../../i18n/locales/en/components.js"), 'utf8');
const zhSource = readFileSync(path.join(here, "../../../i18n/locales/zh-CN/components.js"), 'utf8');
const formStart = dashboardSource.indexOf('<form onSubmit={addToCatalog}>');
const formEnd = dashboardSource.indexOf('</form>', formStart);
assert.ok(formStart >= 0 && formEnd > formStart, 'Catalog form should remain rendered.');

const catalogForm = dashboardSource.slice(formStart, formEnd);

assert.match(
  catalogForm,
  /catalogSpecificMode\s*&&\s*\(/,
  'Catalog form should keep the shoe-name field behind the specific-shoe action only.',
);
assert.match(catalogForm, /catalog_brand_only_help/);
assert.doesNotMatch(
  catalogForm,
  /<select value=\{catalogType\}[\s\S]*disabled=\{!catalogModel\.trim\(\)\}/,
  'Catalog type should remain interactive even before a shoe name is entered.',
);

assert.match(enSource, /"catalog_brand_only_help":\s*"Leave the shoe details blank to create the brand first\./);
assert.match(zhSource, /"catalog_brand_only_help":\s*"只填写品牌即可先创建品牌目录；保存后该品牌会出现在共享跑鞋目录中。"/);

console.log('[PASS] Admin catalog form keeps the shoe-name input scoped to specific-shoe mode.');
