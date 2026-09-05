import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, relativePath), 'utf8');
const dashboardSource = readDashboardSources();
const zhSource = read('../../../i18n/locales/zh-CN/components.js');
const enSource = read('../../../i18n/locales/en/components.js');

assert.match(
  dashboardSource,
  /requestUserBulkConfirmation\('grant_pro',\s*\{ months: 1 \}\)/,
  'Grant Pro should open the designed user bulk-action modal.',
);
assert.match(
  dashboardSource,
  /requestUserBulkConfirmation\('revoke_pro'\)/,
  'Revoke Pro should open the designed user bulk-action modal.',
);
assert.match(
  dashboardSource,
  /requestUserBulkConfirmation\('soft_delete'\)/,
  'Deactivate account should open the designed user bulk-action modal.',
);
assert.doesNotMatch(
  dashboardSource,
  /window\.confirm\(t\('dashboard\.confirm_bulk_users'/,
  'User bulk actions should not rely on a native browser confirmation.',
);
assert.match(
  dashboardSource,
  /isOpen=\{Boolean\(userBulkModal\)\}[\s\S]*?admin-user-bulk-modal__confirm[\s\S]*?confirmUserBulk/,
  'The user bulk-action confirmation should use a designed modal with an explicit confirm action.',
);

for (const [source, locale] of [[zhSource, 'Chinese'], [enSource, 'English']]) {
  assert.match(source, /["']user_bulk_modal_title["']\s*:/, `${locale} user bulk modal title should be translated.`);
  assert.match(source, /["']user_bulk_modal_copy["']\s*:/, `${locale} user bulk modal copy should be translated.`);
  assert.match(source, /["']user_bulk_modal_confirm["']\s*:/, `${locale} user bulk modal confirm label should be translated.`);
}

console.log('[PASS] Admin user bulk actions use the designed confirmation modal.');
