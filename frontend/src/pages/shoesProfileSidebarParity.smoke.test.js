import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const readPage = (name) => readFileSync(path.join(here, name), 'utf8');
const profileSource = readPage('ProfileDashboard.jsx');
const shoesSource = readPage('Shoes.jsx');

const sharedSidebarHooks = [
  'runner-shell-sidebar',
  'runner-shell-brand runner-dashboard-brand',
  'runner-shell-side-nav',
  'runner-shell-side-link',
  'runner-shell-sidebar-footer',
  'runner-shell-workout-btn runner-dashboard-workout-btn',
];

for (const hook of sharedSidebarHooks) {
  assert.ok(profileSource.includes(hook), `Profile sidebar should include ${hook}`);
  assert.ok(shoesSource.includes(hook), `Shoes sidebar should include ${hook}`);
}

assert.ok(
  shoesSource.includes('getRunnerShellNavItems({') && shoesSource.includes("activeKey: 'shoes'"),
  'Shoes should keep the shared numbered runner navigation with Shoes marked active.',
);

assert.ok(
  shoesSource.includes("t('analysis.stitch_brand_subtitle_profile')"),
  'Shoes should use the same sidebar identity line as Profile.',
);

console.log('[PASS] Shoes keeps Profile sidebar parity.');
