import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const appCss = read('./styles/app.css');
const editCss = read('./styles/run-edit-v2.css');
const runCss = read('./styles/run-detail-v2.css');
const drawer = read('./pages/runs/RunEditDrawer.jsx');
const notes = read('./pages/runs/RunNotes.jsx');
const detail = read('./pages/runs/RunDetail.jsx');

// The stylesheet is part of the app's style graph, and app.css still ends with the dialog stylesheet the other contracts expect.
assert.match(appCss, /@import '\.\/run-edit-v2\.css';/, 'run-edit-v2.css must be imported by app.css.');
assert.ok(appCss.indexOf("@import './run-edit-v2.css';") < appCss.indexOf("@import './race-form-modal-v2.css';"), 'run-edit-v2.css must come before race-form-modal-v2.css, which stays last.');

// Every class the drawer and the notes draw with has a rule, so nothing is left unstyled by a typo.
const drawerClasses = new Set([...drawer.matchAll(/run-edit__[-\w]+/g)].map((match) => match[0]));
assert.ok(drawerClasses.size >= 25, 'The drawer should draw with its own run-edit__* classes.');
for (const name of drawerClasses) assert.ok(editCss.includes(`.${name}`), `${name} is used by the edit drawer but has no style.`);
const notesClasses = new Set([...notes.matchAll(/run-detail-v2__notes[-\w]*/g)].map((match) => match[0]));
for (const name of notesClasses) assert.ok(editCss.includes(`.${name}`), `${name} is used by the run notes but has no style.`);

// The drawer is the shared Modal, which is put at the end of the page, outside #root: its rules hang on its own classes.
assert.match(drawer, /<Modal[\s\S]*portalToBody[\s\S]*shellClassName="run-edit-v2-shell"[\s\S]*cardClassName="run-edit-v2-card"/, 'The drawer must be the shared Modal, in a portal, with its own shell and card classes.');
assert.match(editCss, /body \.modal-shell\.run-edit-v2-shell/);
assert.match(editCss, /body \.modal-card\.run-edit-v2-card/);
assert.match(editCss, /background: var\(--re-dialog\) !important/, 'The dialog needs a solid background of its own: the shell\'s glass makes the shared modal translucent.');
const outsideRoot = editCss.split('/* The notes under the title on the run page. */')[0].replace(/\/\*[\s\S]*?\*\//g, '');
assert.doesNotMatch(outsideRoot, /#root/, 'The drawer is outside #root, so its rules cannot hang on it.');
assert.match(editCss, /prefers-reduced-motion: reduce[\s\S]*animation: none/, 'The slide-in has to stop for those who ask for less motion.');

// Colours: the drawer's tokens have a light and a midnight value; the notes take the run page's own tokens; nothing else is raw.
const defined = new Set([...editCss.matchAll(/(--re-[a-z-]+)\s*:/g)].map((match) => match[1]));
const used = new Set([...editCss.matchAll(/var\((--re-[a-z-]+)/g)].map((match) => match[1]));
for (const token of used) assert.ok(defined.has(token), `${token} is used by the edit drawer but not defined.`);
const midnight = editCss.slice(editCss.indexOf('body:is(.theme-midnight'), editCss.indexOf('/* The panel'));
for (const token of ['--re-dialog', '--re-ink', '--re-muted', '--re-faint', '--re-line', '--re-fill', '--re-accent', '--re-on-accent', '--re-error']) {
  assert.ok(midnight.includes(`${token}:`), `${token} needs a midnight value.`);
}
const pageTokens = new Set([...editCss.matchAll(/var\((--v2-[a-z0-9-]+)/g)].map((match) => match[1]));
const pageDefined = new Set([...runCss.matchAll(/(--v2-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
for (const token of pageTokens) {
  if (token === '--v2-good') continue; // has a fallback in the rule
  assert.ok(pageDefined.has(token), `${token} is used by the run notes but the run page does not define it.`);
}
const rulesOnly = editCss.replace(/\.run-edit-v2-card \{[^}]*\}/, '').replace(/body:is\([^)]*\) \.run-edit-v2-card \{[^}]*\}/, '');
assert.doesNotMatch(rulesOnly.replace(/rgba\(18, 22, 28, 0\.42\)|#fff\b|#171717/g, ''), /#[0-9a-fA-F]{3,8}\b/, 'The drawer must use its tokens, not raw colours.');

// The notes are text, never markup, and nothing in them is a label or a span (the shell turns those into captions).
assert.doesNotMatch(notes, /dangerouslySetInnerHTML/, 'Notes are the runner\'s words: they are shown as text.');
assert.doesNotMatch(notes, /<label\b|<span\b/, 'The notes must not use a label or a span: the shell turns them into captions.');

// The run page mounts the drawer once, only while it is open, for the run on screen, and the notes once under the title.
assert.equal((detail.match(/<RunEditDrawer\b/g) ?? []).length, 1, 'RunDetail should mount the edit drawer once.');
assert.match(detail, /\{editOpen \? \(\s*<RunEditDrawer\b/, 'The drawer is mounted only while it is open, so nothing is asked of the server before it is.');
assert.match(detail, /<RunEditDrawer[\s\S]*key=\{`edit-\$\{run\.id\}`\}[\s\S]*runId=\{run\.id\}[\s\S]*provider=\{run\.provider\}[\s\S]*shoes=\{shoes\}/);
assert.equal((detail.match(/<RunNotes\b/g) ?? []).length, 1, 'RunDetail should mount the notes once.');
assert.match(detail, /<RunNotes notes=\{run\.notes\} \/>/);
assert.ok(detail.indexOf('<RunNotes') > detail.indexOf('run-detail-v2__actions'), 'The notes come after the title and its buttons.');
assert.ok(detail.indexOf('run_detail.edit_run') < detail.indexOf("run_detail.share')"), 'Edit comes before Share among the buttons.');

// What was edited reaches the cards drawn from it.
assert.match(detail, /<RunSummaryCard[^>]*refreshToken=\{paceRefresh \+ editVersion\}/);
assert.match(detail, /<RunTrainingCards[^>]*refreshToken=\{editVersion\}/);
assert.match(detail, /<RunLabelsCard[^>]*refreshToken=\{editVersion\}/);
assert.match(detail, /invalidateResourceCache\('\/api\/activities'\)/, 'A saved title or shoe must not be shown from a cached run list.');

// The drawer asks for the run through the shared hook and saves through the two routes that own the data, nothing else.
assert.match(read('./pages/runs/useRunEdit.js'), /\/api\/activities\/\$\{runId\}\/edit/);
const requests = [...drawer.matchAll(/apiJson\(([^,)]+)/g)].map((match) => match[1].trim());
assert.deepEqual(requests, ['`/api/activities/${runId}`', '`/api/shoes/${draft.shoeId ?? 0}/assign/${runId}`'], 'The drawer saves through the edit route and the shoe route only.');
assert.doesNotMatch(drawer, /\bfetch\(|apiFetch/, 'The drawer asks through apiJson only.');
assert.match(drawer, /onClose=\{requestClose\}/, 'Closing from the header, the Escape key or the backdrop goes through the unsaved-changes check.');

console.log('[PASS] Run edit drawer wiring, styles and tokens.');
