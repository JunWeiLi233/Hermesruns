import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
assert.ok(appStyles.indexOf("@import './import-page-v2.css';") > appStyles.indexOf("@import './import-modal-v2.css';"), 'The inline page styling must load after the shared modal styles.');
assert.deepEqual(Object.keys(translations.en.components.import_v2), Object.keys(translations['zh-CN'].components.import_v2), 'Both languages must provide matching import labels.');
console.log('[PASS] Shared import modal page wiring, viewport layout, and localization.');
