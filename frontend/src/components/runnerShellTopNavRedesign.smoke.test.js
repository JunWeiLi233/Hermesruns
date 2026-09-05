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
const styleSource = read('styles/style.generated.css');
const runnerShellStyleSource = read('styles/_split/runner-shell.css');
const liquidGlassStyleSource = read('styles/all-pages-liquid-glass.css');
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
  /Source: frontend\/src\/styles\/_split\/runner-shell\.css/.test(styleSource)
    && /\.runner-shell-topnav--command\s*\{[\s\S]*width:\s*fit-content;[\s\S]*grid-template-columns:\s*minmax\(0,\s*max-content\)\s+auto;/.test(styleSource),
  'The shared runner topnav should collapse to a compact identity + meta grid after route-chip removal.',
);

assert(
  /\.runner-shell-topnav--command\s*\{[\s\S]*padding:\s*0;[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/.test(runnerShellStyleSource),
  'The shared runner topnav should keep only the localized page label without route-chip chrome.',
);

assert(
  /#root\s+\.runner-shell-page\s+\.runner-shell-topnav--command\s*\{[\s\S]*padding:\s*0\s*!important;[\s\S]*border:\s*0\s*!important;[\s\S]*border-radius:\s*0\s*!important;[\s\S]*background:\s*transparent\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/.test(liquidGlassStyleSource),
  'The later liquid-glass runner chrome must not restore a button layer around the top-nav label.',
);

assert(
  /#root\s+\.runner-shell-page\s+\.runner-shell-topnav--command\s*\{[\s\S]*margin:\s*0\s*!important;[\s\S]*overflow:\s*visible\s*!important;/.test(liquidGlassStyleSource)
    && /#root\s+\.runner-shell-page\s+\.runner-shell-topnav--command\s+\.runner-shell-topnav-current-stack\s*\{[\s\S]*margin:\s*0\s*!important;[\s\S]*overflow:\s*visible\s*!important;/.test(liquidGlassStyleSource),
  'The text-only runner label should not be clipped or offset by residual nav spacing.',
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
  "shoes/AddShoes.jsx",
  "analysis/Analysis.jsx",
  "analysis/AnalysisInsightDetail.jsx",
  "muscle-training/MuscleTraining.jsx",
  "prediction/PredictionDetail.jsx",
  "profile/ProfileDashboard.jsx",
  "races/Races.jsx",
  "races/RacesDetail.jsx",
  "rewards/Rewards.jsx",
  "runs/Runs.jsx",
  "schedule/Schedule.jsx",
  "settings/Settings.jsx",
  "shoes/Shoes.jsx",
  "today-run/TodayRun.jsx",
  "weather/WeatherEngine.jsx",
];

runnerPages.forEach((fileName) => {
  const source = readFileSync(path.join(pageRoot, fileName), 'utf8');
  assert(
    source.includes("import RunnerShellTopNav from '../../components/RunnerShellTopNav';"),
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
