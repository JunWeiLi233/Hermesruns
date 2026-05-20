import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const pageRoot = path.join(srcRoot, 'pages');

function read(relativePath) {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const componentSource = read('components/RunnerShellTopNav.jsx');
const styleSource = read('styles/style.css');
const navSource = read('utils/runnerShellNav.js');
const iconSource = read('components/AppIcon.jsx');

assert(
  !/runner-shell-topnav-shortcuts/.test(componentSource)
    && !/runner-shell-topnav-shortcut/.test(componentSource)
    && !/aria-current=/.test(componentSource)
    && !/runner-shell-topnav-shortcuts/.test(styleSource)
    && !/runner-shell-topnav-shortcut/.test(styleSource),
  'RunnerShellTopNav should not render or style the removed route shortcut chip strip.',
);

assert(
  /\.runner-shell-topnav--command\s*\{[\s\S]*grid-template-columns:\s*minmax\(178px,\s*max-content\)\s+minmax\(220px,\s*1fr\)\s+auto;/.test(styleSource)
    && /Runner shell topnav route-chip removal/.test(styleSource)
    && /\.runner-shell-topnav--command\s*\{[\s\S]*width:\s*fit-content;[\s\S]*grid-template-columns:\s*minmax\(178px,\s*max-content\)\s+auto;/.test(styleSource),
  'The shared runner topnav should collapse to a compact identity + meta grid after route-chip removal.',
);

assert(
  /@media \(max-width:\s*860px\)[\s\S]*\.runner-shell-topnav--command\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(styleSource),
  'The compact runner topnav should remain usable on narrow screens.',
);

[
  "key: 'territory'",
  "key: 'workflows'",
  "t('profile.dashboard_nav_weather_engine')",
].forEach((needle) => {
  assert(navSource.includes(needle), `Shared runner nav is missing ${needle}.`);
});

// Rewards was removed from the shared left-side nav by explicit product decision;
// the route still exists at /rewards but no longer appears in getRunnerShellNavItems.
assert(
  !navSource.includes("key: 'rewards'"),
  'Shared runner nav should no longer surface a Rewards entry.',
);

[
  "case 'territory':",
  "case 'account_tree':",
  "case 'fitness_center':",
].forEach((needle) => {
  assert(iconSource.includes(needle), `AppIcon is missing ${needle}.`);
});

const runnerPages = [
  'AddShoes.jsx',
  'Analysis.jsx',
  'AnalysisInsightDetail.jsx',
  'MuscleTraining.jsx',
  'PredictionDetail.jsx',
  'ProfileDashboard.jsx',
  'Races.jsx',
  'RacesDetail.jsx',
  'Rewards.jsx',
  'Runs.jsx',
  'Schedule.jsx',
  'Settings.jsx',
  'Shoes.jsx',
  'Territory.jsx',
  'TodayRun.jsx',
  'WeatherEngine.jsx',
  'WorkflowBuilder.jsx',
];

runnerPages.forEach((fileName) => {
  const source = readFileSync(path.join(pageRoot, fileName), 'utf8');
  assert(
    source.includes("import RunnerShellTopNav from '../components/RunnerShellTopNav';"),
    `${fileName} should import the shared RunnerShellTopNav component.`,
  );
  assert(
    /<RunnerShellTopNav[\s>]/.test(source),
    `${fileName} should render the shared RunnerShellTopNav component.`,
  );
  assert(
    !/<div className="runner-shell-topnav/.test(source),
    `${fileName} still renders the old local runner-shell-topnav markup.`,
  );
});

console.log('[PASS] Runner shell topnav redesign guardrails passed.');
