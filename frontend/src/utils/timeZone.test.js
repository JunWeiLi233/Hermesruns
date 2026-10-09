import assert from 'node:assert/strict';
import { getDeviceTimeZone, listTimeZones } from './timeZone.js';

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

console.log('[PASS] Time zone helpers passed.');
