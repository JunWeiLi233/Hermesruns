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
const runnerShellStyleSource = read('styles/_split/runner-shell.css');
const profileStyleSource = read('styles/_split/profile.css');
const navSource = read('utils/runnerShellNav.js');
const iconSource = read('components/AppIcon.jsx');

assert(
  !/runner-shell-topnav-shortcuts/.test(componentSource)
    && !/runner-shell-topnav-shortcut/.test(componentSource)
    && !/runner-shell-topnav-brand/.test(componentSource)
    && !/>\s*HERMES\s*</.test(componentSource)
    && !/aria-current=/.test(componentSource)
    && !/runner-shell-topnav-shortcuts/.test(styleSource)
    && !/runner-shell-topnav-shortcut/.test(styleSource),
  'RunnerShellTopNav should not render the removed route shortcut strip or HERMES brand pill.',
);

assert(
  /\.runner-shell-topnav--command\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*max-content\)\s+auto;/.test(runnerShellStyleSource)
    && /\.runner-shell-topnav-identity\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(runnerShellStyleSource)
    && /\.runner-shell-topnav-current-stack\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;/.test(runnerShellStyleSource)
    && /\.runner-shell-topnav-current-stack strong\s*\{[\s\S]*overflow-wrap:\s*anywhere;[\s\S]*white-space:\s*normal;/.test(runnerShellStyleSource)
    && /\.runner-shell-topnav-identity\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(profileStyleSource)
    && !/\.runner-shell-topnav-identity\s*\{[\s\S]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\);/.test(profileStyleSource)
    && !/\.runner-shell-topnav-brand\s*\{/.test(runnerShellStyleSource),
  'The shared runner topnav should keep localized page labels inside a single compact identity column after removing the HERMES brand pill.',
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
  'TodayRun.jsx',
  'WeatherEngine.jsx',
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

const removedMapControlKey = ['terr', 'itory'].join('');

assert(
  !navSource.includes(`key: '${removedMapControlKey}'`) && !iconSource.includes(`case '${removedMapControlKey}':`),
  'Removed map-control page should not remain in shared runner nav or app icons.',
);

console.log('[PASS] Runner shell topnav redesign guardrails passed.');
