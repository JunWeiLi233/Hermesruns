import assert from 'node:assert/strict';
import shoeCatalog from '../../../data/shoeCatalog.js';

const r2Brand = shoeCatalog.find((entry) => entry.brand === 'R2 REALRUN');

assert.equal(r2Brand, undefined, 'R2 REALRUN should not be included in the built-in running-shoe brand list.');

console.log('[PASS] R2 REALRUN is absent from the built-in shoe catalog.');
