import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, relativePath), 'utf8');
const runsSource = read('../Runs.jsx');
const styleSource = read('../../../styles/runs-ledger-v2.css');
const runsStyleSource = read('../../../styles/_split/runs.css');
const whiteGridStyleSource = read('../../../styles/grid-cards-white.css');
const liquidGlassStyleSource = read('../../../styles/all-pages-liquid-glass.css');
const appStyleSource = read('../../../styles/app.css');
const page = '#root .runs-dashboard-page.runs-ledger-page';
const history = page + ' .runs-profile-history.runs-ledger-redesign.runs-ledger-v2';

function rule(selector, source = styleSource) {
  const escaped = selector.replace(/[.*+?^()|[\]\\]/g, '\\$&');
  const matches = [...source.matchAll(new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\{([^}]*)\\}', 'g'))];
  assert.ok(matches.length > 0, 'The Runs ledger should retain CSS for ' + selector);
  return matches.map((match) => match[1]).join('\n');
}

const rowStart = runsSource.indexOf('function RunRow(');
const rowEnd = runsSource.indexOf('const RUNS_VIEW_STORAGE_KEY', rowStart);
assert.ok(rowStart >= 0 && rowEnd > rowStart, 'The ledger should retain its reusable run row.');
const row = runsSource.slice(rowStart, rowEnd);

assert.match(runsSource, /runner-shell-page runner-dashboard-page runs-dashboard-page runs-ledger-page/, 'The ledger should remain inside the shared runner shell.');
assert.match(runsSource, /className="recent-runs-shell runs-dashboard-shell runs-profile-history runs-ledger-redesign runs-ledger-v2"/, 'Run history should opt into the v2 ledger styles.');
assert.ok(
  appStyleSource.indexOf("@import './runs-ledger-v2.css';") > appStyleSource.indexOf("@import './grid-cards-white.css';")
    && appStyleSource.indexOf("@import './grid-cards-white.css';") > appStyleSource.indexOf("@import './all-pages-liquid-glass.css';"),
  'The runtime ledger styles should follow the earlier white-card and liquid-glass layers.',
);

assert.match(
  row,
  /className="recent-runs-card-shell runs-ledger-row-shell">\s*<button type="button" className="recent-runs-card runs-ledger-row" data-run-id=\{run\.id \|\| ''\} onClick=\{\(\) => onOpen\(run\)\}>[\s\S]*runs-ledger-row__date[\s\S]*<RoutePreviewThumb[\s\S]*runs-ledger-row__title[\s\S]*runs-ledger-row__meta[\s\S]*runs-ledger-row__num--distance/,
  'Ledger rows should retain an interactive activity, date, route preview, title, provider, and metric columns.',
);
for (const metric of ['distance', 'average_pace', 'moving_time']) {
  assert.match(
    row,
    new RegExp('aria-label=\\{\\x60\\$\\{t\\(\\x27runs\\.metric_' + metric + '\\x27\\)\\}'),
    'The ' + metric + ' column should retain its localized accessible label.',
  );
}
assert.match(row, /formatDistance\(distanceKm, 1, lang\)[\s\S]*formatPace\(distanceKm, movingTimeSeconds, lang\)[\s\S]*formatDuration\(movingTimeSeconds\)/, 'Run rows should retain formatted distance, pace, and moving-time values.');
assert.match(row, /<time className="runs-ledger-row__full-date" dateTime=\{started\.toISOString\(\)\}/, 'Grid and mobile rows should retain a machine-readable full date.');
assert.match(row, /onDelete && \([\s\S]*aria-label=\{t\('runs\.delete'\)\}[\s\S]*e\.stopPropagation\(\); onDelete\(run\)/, 'Deletion should remain a separate labeled action that does not open the run.');

assert.match(rule(history + ' .recent-runs-month-group'), /overflow:\s*hidden;[\s\S]*border-radius:\s*16px !important;[\s\S]*background:\s*var\(--v2-card\) !important;[\s\S]*box-shadow:\s*none !important;/, 'Each month should clip its header and rows inside one independent card.');
assert.match(rule(history + ' .recent-runs-month-header'), /width:\s*100%;[\s\S]*background:\s*transparent !important;[\s\S]*color:\s*var\(--v2-ink\) !important;/, 'Month headers should inherit the card surface with readable text.');
assert.match(rule(history + ' button.recent-runs-card.runs-ledger-row'), /grid-template-columns:\s*var\(--v2-cols\);[\s\S]*background:\s*transparent !important;[\s\S]*color:\s*var\(--v2-ink\) !important;[\s\S]*box-shadow:\s*none !important;/, 'Ledger rows should use aligned columns without accidental paper strips or shadows.');
assert.match(rule('.runner-shell-page.runs-dashboard-page .runs-profile-history button.recent-runs-card', liquidGlassStyleSource), /background:\s*transparent !important;[\s\S]*background-image:\s*none !important;/, 'The earlier liquid-glass reset should still clear the legacy card gradient inherited by ledger rows.');
assert.doesNotMatch(liquidGlassStyleSource, /\.runner-shell-page \.runs-dashboard-page \.runs-profile-history/, 'Run-history resets should use the compound page-root selector.');
assert.match(rule(page, runsStyleSource), /--runs-page-card:\s*#fff;/, 'The ledger card token should retain a solid white light-theme surface.');
assert.match(rule(history), /--v2-card:\s*var\(--runs-page-card, #fff\);[\s\S]*--v2-ink:\s*var\(--runs-page-ink, #1c1917\);/, 'V2 should inherit theme-aware surfaces and ink rather than force white in every theme.');
assert.match(rule('body:is(.theme-midnight, .theme-high-contrast) ' + page, runsStyleSource), /--runs-page-card:\s*var\(--profile-night-card,[\s\S]*--runs-page-ink:\s*var\(--profile-night-ink,/, 'Dark ledger cards and text should retain the shared night tokens.');
assert.match(rule('body:is(.theme-midnight, .theme-high-contrast) ' + history), /--v2-seg-active:[\s\S]*--v2-primary:[\s\S]*--v2-primary-ink:/, 'Dark-mode active controls should keep readable surfaces and text.');

assert.match(
  whiteGridStyleSource,
  /#root \.runs-dashboard-page\.runs-ledger-page::before,\s*#root \.runs-dashboard-page\.runs-ledger-page \.runner-shell-canvas::before\s*\{[^}]*content:\s*none !important;[^}]*display:\s*none !important;[^}]*background:\s*none !important;/,
  'The Runs page and canvas should not paint decorative grid strips in the gutter.',
);
assert.match(
  whiteGridStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.runs-dashboard-page \.runs-profile-history :is\(\s*\.recent-runs-card-list,\s*\.recent-runs-page-list\s*\)\s*\{[^}]*background:\s*transparent !important;[^}]*background-image:\s*none !important;[^}]*box-shadow:\s*none !important;/,
  'The history-list wrappers should stay transparent so month cards remain separate.',
);

assert.match(
  runsSource,
  /className="recent-runs-month-header recent-runs-month-toggle"\s*aria-expanded=\{!collapsed\}\s*aria-controls=\{panelId\}\s*onClick=\{\(\) => toggleMonthFold\(group\.key\)\}/,
  'Month headers should retain their accessible expand/collapse control.',
);
assert.match(runsSource, /id=\{panelId\} className="recent-runs-month-grid" hidden=\{collapsed\}/, 'Collapsed history groups should remain hidden.');
assert.match(rule(history + ' .recent-runs-month-grid[hidden]'), /display:\s*none !important;/, 'Ledger display rules should respect the hidden attribute.');
assert.match(runsSource, /group\.runs\.map\([\s\S]*<RunRow[\s\S]*onOpen=\{openRun\}/, 'Month groups should still render their real activity rows with the detail navigation callback.');
assert.match(
  runsSource,
  /function openRun\(run\) \{\s*sessionStorage\.setItem\('hermes_selected_run', JSON\.stringify\(run\)\);\s*navigate\(buildRunDetailPath\(run\.id \|\| ''\)\);/,
  'Opening a ledger row should preserve the selected activity cache and ID-based detail route.',
);
assert.match(runsSource, /cachedApiJson\('\/api\/activities'\)[\s\S]*?setAllRuns\(list\);[\s\S]*?setLoadState\('ready'\)/, 'The ledger should retain cached full-history loading and its ready state.');
assert.match(runsSource, /invalidateResourceCache\('\/api\/activities'\)/, 'Activity mutations should still invalidate the history cache.');

assert.match(runsSource, /if \(loadState === 'loading'\) return <PageSkeleton variant="runs" \/>;/, 'Initial loading should retain the dedicated Runs skeleton.');
assert.match(runsSource, /loadState === 'error'[\s\S]*t\('runs\.load_error'\)/, 'History load failures should retain localized status.');
assert.match(runsSource, /loadState === 'ready' && filteredRuns\.length === 0[\s\S]*t\('runs\.empty'\)/, 'An empty filtered history should retain localized feedback.');
assert.match(runsSource, /hasMoreRuns \? \([\s\S]*aria-live="polite"[\s\S]*typeof IntersectionObserver === 'undefined'[\s\S]*setVisibleRunsCount\(\(current\) => Math\.min\(current \+ RUNS_RENDER_BATCH_SIZE, filteredRuns\.length\)\)[\s\S]*t\('runs\.load_more'\)[\s\S]*t\('runs\.loading'\)/, 'Full history should remain reachable through batched loading and its manual fallback.');
assert.match(runsSource, /runs-ledger-v2__view[\s\S]*setRunsView\('list'\)[\s\S]*aria-pressed=\{runsView === 'list'\}[\s\S]*setRunsView\('grid'\)[\s\S]*aria-pressed=\{runsView === 'grid'\}/, 'The ledger should retain accessible list and grid switches.');

assert.match(rule(history + ' .runs-ledger-v2__list.is-grid .recent-runs-month-grid:not([hidden])'), /display:\s*grid !important;[\s\S]*grid-template-columns:\s*repeat\(auto-fill, minmax\(min\(100%, 250px\), 1fr\)\) !important;/, 'Grid view should adapt its cards to the available width without reopening collapsed groups.');
const mobileStart = styleSource.indexOf('@media (max-width: 860px)');
const mobileEnd = styleSource.indexOf('@media (max-width: 640px)', mobileStart);
assert.ok(mobileStart >= 0 && mobileEnd > mobileStart, 'The ledger should retain its mobile rules.');
assert.match(rule(history + ' .runs-ledger-v2__list.is-list button.recent-runs-card.runs-ledger-row', styleSource.slice(mobileStart, mobileEnd)), /grid-template-columns:\s*56px minmax\(0, 1fr\) auto;/, 'Mobile ledger rows should keep the route thumbnail, title, distance, and pace readable.');
assert.match(rule('.runs-dashboard-page .runs-profile-history button.recent-runs-card:focus-visible', runsStyleSource), /outline:\s*3px solid/, 'Ledger rows should retain a visible keyboard focus outline.');
assert.match(rule(page + ' .runs-ledger-v2__search:focus-within'), /box-shadow:\s*0 0 0 2px var\(--v2-accent\) !important;/, 'The ledger search should retain its visible focus state.');

console.log('[PASS] Run-history v2 ledger background guardrails passed.');
