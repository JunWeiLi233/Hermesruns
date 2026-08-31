import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'RacesDetail.jsx'), 'utf8');
const topbarStart = source.indexOf('className="runner-shell-topbar runner-dashboard-shell-topbar race-detail-topbar"');
const topbarEnd = source.indexOf('</header>', topbarStart);
const topbarSource = source.slice(topbarStart, topbarEnd);

assert.ok(topbarStart >= 0 && topbarEnd > topbarStart, 'Race detail should render a dedicated topbar.');
assert.match(
  topbarSource,
  /<RunnerShellTopNav[\s\S]*activeLabel=\{topnavTitle\}[\s\S]*navigate=\{navigate\}/,
  'Race detail should keep the current race title as the topbar label.',
);
assert.doesNotMatch(
  topbarSource,
  /parentLabel=\{t\('profile\.dashboard_nav_races'\)\}|parentRoute="\/races"/,
  'Race detail should use the one-line topbar treatment instead of a two-line race breadcrumb.',
);
assert.match(topbarSource, /TopbarNotifications|runner-shell-icon-btn|TopbarUserMenu/);

console.log('[PASS] Race detail topbar matches the one-line runner shell treatment.');
