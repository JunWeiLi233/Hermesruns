const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const plannedRouteSource = fs.readFileSync(
  path.join(root, 'main/java/com/hermes/backend/PlannedRoute.java'),
  'utf8',
);

const failures = [];

if (!/name\s*=\s*"planned_route"/.test(plannedRouteSource)) {
  failures.push('PlannedRoute should still map to the planned_route table.');
}

if (!/columnDefinition\s*=\s*"TEXT"/.test(plannedRouteSource)) {
  failures.push('PlannedRoute.waypoints should use PostgreSQL-compatible TEXT DDL.');
}

if (/columnDefinition\s*=\s*"CLOB"/.test(plannedRouteSource)) {
  failures.push('PlannedRoute.waypoints must not use CLOB because PostgreSQL rejects that DDL.');
}

if (failures.length > 0) {
  console.error('[FAIL] PlannedRoute schema guard');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('[PASS] PlannedRoute schema guard passed.');
