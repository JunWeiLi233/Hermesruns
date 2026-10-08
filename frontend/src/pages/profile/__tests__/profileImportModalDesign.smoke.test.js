import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import translations from '../../../i18n/translations.js';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const modal = read('../../../components/ImportActivityModal.jsx');
const styles = read('../../../styles/import-modal-v2.css');
const appStyles = read('../../../styles/app.css');
for (const [page, relative, count, refresh] of [
  ['Runs', '../../runs/Runs.jsx', 2, 'refreshRuns'],
  ['Analysis', '../../analysis/Analysis.jsx', 1, 'loadAnalysisData'],
]) {
  const source = read(relative);
  assert.equal((source.match(/<ImportActivityModal\b/g) || []).length, count, `${page} must use the shared modal in every render path.`);
  assert.match(source, new RegExp(`onImported=\\{${refresh}\\}`), `${page} must refresh its activities after import.`);
  assert.doesNotMatch(source, /renderImportModal|function handleImport\(|fitExportFiles|import-source-grid/, `${page} must not retain a duplicate import flow.`);
}
assert.match(modal, /portalToBody/, 'The import modal must appear above page navigation.');
assert.match(modal, /invalidateResourceCache\('\/api\/activities'\)/, 'A successful import must invalidate activity caches before refreshing.');
assert.match(modal, /role="tablist"[\s\S]*role="tab"[\s\S]*role="tabpanel"/, 'The source selector must expose its tabs and panel.');
assert.match(styles, /width:\s*min\(560px, calc\(100vw - 32px\)\)/, 'The new modal must fit desktop and mobile viewports.');
assert.match(styles, /\.import-v2-body\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/, 'Content must scroll while the footer remains reachable.');
assert.match(styles, /\.import-v2-actions\s*\{[^}]*flex-shrink:\s*0/, 'Import actions must stay visible in a short viewport.');
assert.match(styles, /body:is\(\.theme-midnight, \.theme-high-contrast\) \.modal-card\.import-v2-card/, 'The shared modal must support dark themes.');
const styleImports = [];
postcss.parse(appStyles).walkAtRules('import', ({ params }) => styleImports.push(params.slice(1, -1)));
const modalStyles = './import-modal-v2.css';
assert.equal(styleImports.filter((file) => file === modalStyles).length, 1, 'Load the shared import modal styles exactly once.');
for (const owner of [
  './_split/profile.css', './_split/runs.css', './_split/analysis.css',
  './_split/settings.css', './_split/misc.css', './liquid-glass.css',
  './all-pages-liquid-glass.css', './mobile.css', './dark-mode-final-fixes.css',
]) {
  assert.ok(styleImports.includes(owner), `Keep the existing ${owner} dialog cascade owner.`);
  assert.ok(styleImports.indexOf(modalStyles) > styleImports.lastIndexOf(owner), `Load shared import modal styles after ${owner}.`);
}
const modalSheet = postcss.parse(styles);
const lightCard = modalSheet.nodes.find((rule) => rule.selector === '.modal-card.import-v2-card');
const darkCard = modalSheet.nodes.find((rule) => rule.selector === 'body:is(.theme-midnight, .theme-high-contrast) .modal-card.import-v2-card');
assert.ok(lightCard && darkCard && modalSheet.nodes.indexOf(darkCard) > modalSheet.nodes.indexOf(lightCard), 'The scoped dark card must override the modal light surface.');
const darkBackground = darkCard.nodes.find((node) => node.prop === 'background');
assert.ok(darkBackground?.important, 'The import dialog dark surface must win over the important light background.');
assert.match(darkBackground.value, /^var\(--profile-night-solid,/);
assert.ok(darkCard.nodes.some((node) => node.prop === '--im-ink' && node.value === '#f8f4ef'), 'Dark import dialogs must retain readable Profile ink.');

// Later route dialogs may load after this modal, but shared dialog hooks must
// stay beneath their own card/shell so they cannot override the import dialog.
for (const file of styleImports.slice(styleImports.indexOf(modalStyles) + 1)) {
  postcss.parse(read(`../../../styles/${file}`)).walkRules((rule) => {
    if (!/\.modal-(?:card|shell|header|form)\b/.test(rule.selector)) return;
    for (const selector of rule.selectors) {
      assert.match(selector, /\.(?:scan|edit|garmin)-v2-(?:card|shell)\b/, `${file} must scope shared dialog styles to its own modal: ${selector}`);
    }
  });
}
assert.deepEqual(Object.keys(translations.en.components.import_v2), Object.keys(translations['zh-CN'].components.import_v2), 'Both languages must provide matching import labels.');
console.log('[PASS] Shared import modal page wiring, viewport layout, and localization.');
