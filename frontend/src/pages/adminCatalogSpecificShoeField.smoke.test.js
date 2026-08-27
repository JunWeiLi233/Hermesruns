import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');
const enSource = readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8');

assert.match(dashboardSource, /const \[catalogSpecificMode, setCatalogSpecificMode\] = useState\(false\);/);
assert.match(
  dashboardSource,
  /openCatalogSeries\(\{ brand: catalogBrowserBrandEntry\.brand \}, \{ specific: true \}\)/,
  'The 添加具体鞋款 action should open the modal in specific-shoe mode.',
);
assert.match(
  dashboardSource,
  /onClick=\{\(\) => openCatalogSeries\(\{ brand: catalogBrowserBrandEntry\.brand \}\)\}/,
  'The regular 添加系列 card should keep the brand-only flow.',
);
assert.match(
  dashboardSource,
  /if \(!brand \|\| \(catalogSpecificMode && !model\) \|\| catalogSaving\) return;/,
  'Specific-shoe mode should require a concrete shoe name before submitting.',
);
assert.match(
  dashboardSource,
  /catalogSpecificMode\s*&&\s*\([\s\S]*catalog_specific_shoe[\s\S]*catalogModel[\s\S]*required/,
  'The specific-shoe modal should render a required shoe-name input.',
);
assert.match(zhSource, /"catalog_specific_shoe":\s*"具体鞋款"/);
assert.match(zhSource, /"catalog_specific_shoe_placeholder":\s*"例如：Nimbus 25"/);
assert.match(enSource, /"catalog_specific_shoe":\s*"Specific shoe"/);
assert.match(enSource, /"catalog_specific_shoe_placeholder":\s*"For example: Nimbus 25"/);

console.log('[PASS] Specific-shoe catalog action renders and validates a concrete shoe input.');
