import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import en from '../../../i18n/locales/en/components.js';
import zh from '../../../i18n/locales/zh-CN/components.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(path.join(here, '../MuscleTraining.jsx'), 'utf8');
const css = readFileSync(path.join(here, '../../../styles/muscle-training-week-v2.css'), 'utf8');
const appCss = readFileSync(path.join(here, '../../../styles/app.css'), 'utf8');
const weekHelpers = readFileSync(path.join(here, '../strengthWeek.js'), 'utf8');

// The redesign lives inside the existing runner shell.
for (const hook of ['runner-shell-sidebar', 'runner-shell-topbar', 'runner-shell-side-nav', 'runner-shell-footer']) {
  assert.ok(page.includes(hook), `Keep the shared ${hook}.`);
}
for (const component of ['RunnerShellTopNav', 'TopbarNotifications', 'TopbarUserMenu', 'FooterNavLinks']) {
  assert.ok(page.includes(`<${component}`), `Keep ${component} in the shell.`);
}
assert.match(page, /setIsSidebarCollapsed\(\(current\) => !current\)/);
assert.match(page, /data-muscle-theme=\{resolvedMuscleTheme\}/);
assert.doesNotMatch(page, /muscleThemeOverride|handleMuscleThemeSelect|MUSCLE_THEME_STORAGE_KEY/);

for (const hook of ['mt-top-workbench mt-week-v2', 'mt-week-v2-strip', 'mt-week-v2-day-panel', 'mt-week-v2-exercises', 'mt-week-v2-coverage', 'mt-week-v2-activity']) {
  assert.ok(page.includes(hook), `The strength week includes ${hook}.`);
}
assert.doesNotMatch(page, /className="mt-exercises"|className="mt-media-rail"|<MuscleHeatmap/);
assert.match(page, /aria-labelledby="mt-week-title"/);
assert.match(page, /aria-labelledby="mt-week-day-title"/);
assert.match(page, /aria-labelledby="mt-week-coverage-title"/);
assert.match(page, /aria-expanded=\{isOpen\}[\s\S]*?aria-controls=/);
assert.match(page, /resolveExerciseReferenceImage\(item, ''\)/);
assert.match(page, /exerciseCopy\.steps\.map/);

// Coverage counts planned sessions, without inventing completed area data.
assert.match(weekHelpers, /days\.filter\(\(day\) => day\.items\.some/);
assert.match(page, /Math\.max\(1, weekStrengthCount\)/);
assert.match(page, /v3_coverage_count/);
assert.match(page, /weeks=\{12\}[\s\S]*?compact/);
assert.match(page, /v3_streak/);

const styleImports = [];
postcss.parse(appCss).walkAtRules('import', ({ params }) => styleImports.push(params.slice(1, -1)));
const weekStyles = './muscle-training-week-v2.css';
assert.equal(styleImports.filter((file) => file === weekStyles).length, 1, 'Load the strength-week stylesheet exactly once.');
for (const owner of [
  './_split/muscle-training.css', './_split/light-theme-overrides.css',
  './muscle-training-hermes-redesign.css', './muscle-training-profile-alignment.css',
  './all-pages-liquid-glass.css', './muscle-training-action-list.css',
  './mobile.css', './dark-mode-final-fixes.css',
]) {
  assert.ok(styleImports.includes(owner), `Keep the existing ${owner} cascade owner.`);
  assert.ok(styleImports.indexOf(weekStyles) > styleImports.lastIndexOf(owner), `Load strength-week styles after ${owner}.`);
}
const weekDarkRule = postcss.parse(css).nodes.find((rule) => rule.selector === 'body:is(.theme-midnight, .theme-high-contrast) #root .runner-dashboard-page:has(.mt-week-v2)');
assert.ok(weekDarkRule, 'Scope both dark themes to the strength-week page.');
const weekDarkTokens = Object.fromEntries(weekDarkRule.nodes.filter((node) => node.type === 'decl').map(({ prop, value }) => [prop, value]));
assert.match(weekDarkTokens['--mw-card'], /^var\(--profile-night-card,/);
assert.equal(weekDarkTokens['--mw-ink'], '#f8f4ef', 'Keep readable Profile-derived ink after the shared palette loads.');
assert.match(css, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
assert.match(css, /theme-midnight, \.theme-high-contrast/);
assert.match(css, /:focus-visible/);
assert.match(css, /@media \(max-width: 720px\)/);
assert.match(css, /overflow-x: auto; scroll-snap-type: x proximity/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /\.runner-shell-(?:topbar|sidebar)\s*\{/, 'Redesign styles must not replace the shell bars.');

for (const [locale, dictionary] of [['en', en], ['zh-CN', zh]]) {
  for (const key of ['v2_week_kicker', 'v2_week_title', 'v2_today', 'v2_run_rest', 'v2_no_strength', 'v2_day_run', 'v2_coverage_title', 'v2_coverage_unit']) {
    assert.ok(dictionary.muscle_training[key], `${locale} includes ${key}.`);
  }
  for (const key of ['v3_week_kicker', 'v3_streak', 'v3_start_session', 'v3_complete_session', 'v3_coverage_legs', 'v3_coverage_hips', 'v3_coverage_calves', 'v3_coverage_core', 'v3_coverage_upper', 'v3_history_title']) {
    assert.ok(dictionary.muscle_training[key], `${locale} includes ${key}.`);
  }
  assert.ok(dictionary.muscle_training.v2_week_kicker.includes('{count}'));
  assert.ok(dictionary.muscle_training.v2_day_run.includes('{run}'));
}

console.log('[PASS] Muscle Training strength-week redesign and shell guardrails passed.');
