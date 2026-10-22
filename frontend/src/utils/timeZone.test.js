import assert from 'node:assert/strict';
import { getAccountDate, getDeviceTimeZone, listTimeZones } from './timeZone.js';

assert.equal(typeof getDeviceTimeZone(), 'string', 'The device zone is a string, empty when the browser will not say.');

const zones = listTimeZones('Pacific/Nowhere', '', undefined);
assert.ok(zones.includes('UTC'), 'UTC is always offered.');
assert.ok(zones.includes('Pacific/Nowhere'), 'A zone the runner already has is always offered, even if the browser does not list it.');
assert.ok(!zones.includes(''), 'Blank extras are ignored.');
assert.equal(new Set(zones).size, zones.length, 'No zone is listed twice.');
assert.deepEqual(zones, [...zones].sort((a, b) => a.localeCompare(b)), 'Zones are sorted for the picker.');
if (typeof Intl.supportedValuesOf === 'function') {
  assert.ok(zones.includes('America/New_York'), 'The browser zone list is used when it exists.');
}

const instant = new Date('2026-10-07T01:00:00Z');
assert.equal(getAccountDate('America/Los_Angeles', instant), '2026-10-06');
assert.equal(getAccountDate('Asia/Shanghai', instant), '2026-10-07');
for (const zone of [undefined, '', 'invalid-zone', 'UTC']) assert.equal(getAccountDate(zone, instant), '2026-10-07');
assert.equal(getAccountDate('America/New_York', new Date('2026-11-01T04:30:00Z')), '2026-11-01', 'DST transition uses the account date.');
console.log('[PASS] Time zone helpers passed.');
