import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  formatDateForLocale,
  formatListForLocale,
  formatNumberForLocale,
  getIntlLocale,
  normalizeLocale,
} from './localeRegistry.js';
import { translate } from './translationRuntime.js';

assert.equal(DEFAULT_LOCALE, 'en');
assert.deepEqual(SUPPORTED_LOCALES, ['en', 'zh-CN']);
assert.equal(normalizeLocale('en-US'), 'en');
assert.equal(normalizeLocale('zh-Hans-CN'), 'zh-CN');
assert.equal(normalizeLocale('es-MX'), DEFAULT_LOCALE);
assert.equal(getIntlLocale('en'), 'en-US');
assert.equal(getIntlLocale('zh'), 'zh-CN');

assert.equal(formatNumberForLocale('en', 1234.5), '1,234.5');
assert.match(formatDateForLocale('en', '2026-08-14T12:00:00Z', { timeZone: 'UTC', year: 'numeric' }), /2026/);
assert.equal(formatListForLocale('en', ['easy run', 'strides']), 'easy run and strides');

assert.equal(translate('en', 'races.loading'), 'Loading races...');
assert.equal(translate('zh-CN', 'races.loading').length > 0, true);
assert.equal(
  translate('en', 'profile.shoe_count', { count: 3 }),
  '3 active shoes',
  'Translation interpolation should replace named tokens.',
);

let missingKey = null;
const missingValue = translate('en', 'profile.this_key_does_not_exist', undefined, (key) => {
  missingKey = key;
});
assert.equal(missingKey, 'profile.this_key_does_not_exist');
assert.equal(missingValue, 'This key does not exist');

console.log('[PASS] Locale registry, fallback, interpolation, and formatting contract passed.');
