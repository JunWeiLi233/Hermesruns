import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'TodayRun.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  pageSource,
  /import\s+\{\s*getRunnerShellNavItems\s*\}\s+from\s+'\.\.\/utils\/runnerShellNav';/,
  'Today Run should import the shared runner-shell nav helper.',
);

assert.match(
  pageSource,
  /const navItems = useMemo\(\s*\(\) => getRunnerShellNavItems\(\{ t, lang \}\),/s,
  'Today Run should build its sidebar nav from the shared runner-shell helper.',
);

assert.doesNotMatch(
  pageSource,
  /useLocation|location\.pathname/,
  'Today Run should not keep route-specific sidebar activation logic once it aligns to the shared shell helper.',
);

assert.match(
  pageSource,
  /onClick=\{\(\) => navigate\('\/today-run'\)\}[\s\S]*dashboard_start_workout/s,
  'Today Run should keep the shared runner-shell workout CTA in the sidebar footer.',
);

assert.match(
  styleSource,
  /\.today-run-plan-page \.runner-shell-canvas \{\s*padding-inline:\s*clamp\(18px, 2\.4vw, 32px\);/s,
  'Today Run should align its canvas padding with other runner-shell pages.',
);

assert.doesNotMatch(
  styleSource,
  /\.today-run-plan-page \.runner-shell-sidebar|\.today-run-plan-page \.runner-shell-topbar/,
  'Today Run should not keep page-specific shell sidebar/topbar overrides once aligned with the shared runner shell.',
);

console.log('[PASS] Today Run shell alignment guard passed.');
