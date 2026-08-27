import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const monitoringCss = readFileSync(path.join(here, '../styles/admin-monitoring-dashboard.css'), 'utf8');

const warningIconRule = monitoringCss.match(/\.admin-audit-clear-modal__warning-icon\s*\{([^}]*)\}/)?.[1];
assert.ok(warningIconRule, 'The audit clear modal should define a dedicated warning icon rule.');
assert.match(warningIconRule, /width:\s*20px/);
assert.match(warningIconRule, /height:\s*20px/);
assert.match(warningIconRule, /display:\s*block/);

console.log('dashboard audit clear modal icon smoke test passed');
