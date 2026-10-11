// The Analysis page said "updated 1 days ago" under Training zones.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatTrainingZoneBasisUpdated } from './zoneBasisAge.js';

const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);
const now = Date.parse('2026-10-10T12:00:00Z');
const ago = (hours) => new Date(now - hours * 3600 * 1000);

assert.equal(formatTrainingZoneBasisUpdated(ago(3), t, now), 'analysis.stitch_zone_basis_updated_today');
assert.equal(formatTrainingZoneBasisUpdated(ago(24), t, now), 'analysis.stitch_zone_basis_updated_one_day', 'exactly a day ago is one day, in the singular');
assert.equal(formatTrainingZoneBasisUpdated(ago(47), t, now), 'analysis.stitch_zone_basis_updated_one_day');
assert.equal(formatTrainingZoneBasisUpdated(ago(48), t, now), 'analysis.stitch_zone_basis_updated_days {"count":2}');
assert.equal(formatTrainingZoneBasisUpdated('not a date', t, now), 'analysis.stitch_zone_basis_updated_recently');
assert.equal(formatTrainingZoneBasisUpdated(ago(-5), t, now), 'analysis.stitch_zone_basis_updated_today', 'a time a little in the future is today, not a negative number of days');

// The singular is worded in both languages.
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const locale of ['en', 'zh-CN']) {
  const strings = readFileSync(path.join(src, 'i18n', 'locales', locale, 'components.js'), 'utf8');
  assert.match(strings, /"stitch_zone_basis_updated_one_day":/, `${locale} has the one-day wording`);
}
const english = readFileSync(path.join(src, 'i18n', 'locales', 'en', 'components.js'), 'utf8');
assert.match(english, /"stitch_zone_basis_updated_one_day": "updated 1 day ago"/);

console.log('[PASS] Zone basis age wording passed.');
