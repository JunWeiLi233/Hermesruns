import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const css = read('./styles/goals-v2.css');
const appCss = read('./styles/app.css');
const profileCss = read('./styles/profile-entry.css');

// The Profile route has a stylesheet of its own (profile-entry.css), so a card that sits there needs its styles in both.
assert.match(appCss, /@import '\.\/goals-v2\.css';/, 'goals-v2.css must be imported by app.css.');
assert.match(profileCss, /@import '\.\/goals-v2\.css';/, 'goals-v2.css must be imported by profile-entry.css: the Profile page does not load app.css.');
assert.ok(
  appCss.indexOf("@import './goals-v2.css';") < appCss.indexOf("@import './race-form-modal-v2.css';"),
  'The race form modal stylesheet stays last in app.css.',
);

// Every class the goals components draw with has a rule, so nothing is left unstyled by a typo.
const sources = ['GoalRow.jsx', 'GoalFormModal.jsx', 'GoalsCard.jsx', 'RunGoalsCard.jsx'].map((name) => read(`./components/goals/${name}`)).join('\n');
const classes = new Set([...sources.matchAll(/(?:goals-v2|goal-form|goal-v2-card)(?:__[-\w]+)?/g)].map((match) => match[0]));
assert.ok(classes.size >= 25, 'The goals components should draw with their own goals-v2__* and goal-form__* classes.');
for (const name of classes) {
  assert.ok(css.includes(`.${name}`), `${name} is used by a goals component but has no style.`);
}

// Colours come from tokens: light and midnight for the cards and for the dialog.
const tokens = new Set([...css.matchAll(/var\((--gl-[a-z0-9-]+)/g)].map((match) => match[1]));
const defined = new Set([...css.matchAll(/(--gl-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
for (const token of tokens) assert.ok(defined.has(token), `${token} is used by the goals styles but never defined.`);
assert.match(css, /body:is\(\.theme-midnight, \.theme-high-contrast\) #root \.goals-v2,\s*body:is\(\.theme-midnight, \.theme-high-contrast\) \.goal-v2-card \{/, 'The goals styles must have a midnight palette for the cards and the dialog.');
const afterPalette = css.slice(css.indexOf('#root .goals-v2 :is(h2, h3, h4, p, ul)'));
assert.doesNotMatch(afterPalette, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'The goals rules must use tokens, not raw colours.');

// The dialog is put at the end of the page by the shared Modal, outside #root, so its styles cannot hang on #root.
const dialogRules = css.slice(css.indexOf('/* The dialog'));
assert.doesNotMatch(dialogRules.split('@media')[0].replace(/\/\*[\s\S]*?\*\//g, ''), /#root \.goal-/, 'Dialog styles must not be scoped to #root.');

// The card sits on three pages and none of them fetches goals itself.
const profile = read('./pages/profile/ProfileDashboard.jsx');
assert.equal((profile.match(/<GoalsCard defer \/>/g) ?? []).length, 1, 'The Profile page mounts the goals card once, deferred.');
assert.doesNotMatch(profile, /\/api\/goals/, 'The Profile page must not fetch goals itself (its first paint is pinned).');
assert.equal((read('./pages/training-log/TrainingLog.jsx').match(/<GoalsCard \/>/g) ?? []).length, 1, 'The Training log mounts the goals card once.');
const runDetail = read('./pages/runs/RunDetail.jsx');
assert.match(runDetail, /<RunGoalsCard key=\{`goals-\$\{run\.id\}`\} runId=\{run\.id\} \/>/, 'The run page mounts the goals strip for the run on screen.');
assert.doesNotMatch(runDetail, /\/api\/goals/, 'The run page must not fetch goals itself.');

console.log('[PASS] Goals wiring, styles and tokens.');
