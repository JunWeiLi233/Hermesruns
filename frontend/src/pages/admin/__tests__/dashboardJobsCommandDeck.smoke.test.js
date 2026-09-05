import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const styleSource = [
  "../../../styles/style.generated.css",
  "../../../styles/admin-monitoring-dashboard.css",
  "../../../styles/grid-cards-white.css",
].map((file) => readFileSync(path.join(here, file), 'utf8')).join('\n');
const translationsSource = [
  "../../../i18n/translations.js",
  "../../../i18n/locales/en/index.js",
  "../../../i18n/locales/en/components.js",
  "../../../i18n/locales/zh-CN/index.js",
  "../../../i18n/locales/zh-CN/components.js",
].map((file) => readFileSync(path.join(here, file), 'utf8')).join('\n');

assert.match(
  dashboardSource,
  /admin-jobs-command-deck/,
  'Dashboard jobs should render a dedicated command-deck shell instead of only a filter row and flat table.',
);

assert.match(
  dashboardSource,
  /admin-jobs-command-deck__hero/,
  'Dashboard jobs should render a hero section for the editorial command-deck top fold.',
);

assert.match(
  dashboardSource,
  /admin-jobs-command-deck__summary-grid/,
  'Dashboard jobs should render a summary grid for derived operational signals.',
);

assert.match(
  dashboardSource,
  /admin-jobs-command-deck__workspace/,
  'Dashboard jobs should render a split workspace for the terminal list and selected-job detail panel.',
);

assert.match(
  dashboardSource,
  /admin-jobs-terminal__row/,
  'Dashboard jobs should render selectable terminal rows instead of plain table rows only.',
);

assert.match(
  dashboardSource,
  /admin-jobs-terminal__group/,
  'Dashboard jobs should group terminal rows by the user who created them.',
);

assert.match(
  dashboardSource,
  /function JobQueueRowComponent\(/,
  'Dashboard jobs should isolate terminal row rendering for bounded virtualization.',
);

assert.match(
  dashboardSource,
  /rowComponent=\{JobQueueRowComponent\}/,
  'Dashboard jobs should virtualize each actor stream instead of mounting every historical row at once.',
);

assert.match(
  dashboardSource,
  /admin-jobs-terminal__row-shell/,
  'Virtualized jobs rows should keep the existing terminal row layout inside a positioned shell.',
);

assert.match(
  dashboardSource,
  /className="admin-jobs-terminal__row-shell" \{\.\.\.ariaAttributes\}/,
  'Virtualized jobs rows should keep list semantics on the wrapper so the inner control remains a native button.',
);

assert.match(
  styleSource,
  /\.admin-jobs-command-deck\s*\{/,
  'Dashboard styles should define the jobs command-deck shell.',
);

assert.match(
  styleSource,
  /\.admin-jobs-command-deck__hero\s*\{/,
  'Dashboard styles should define the jobs hero shell.',
);

assert.match(
  styleSource,
  /\.admin-jobs-terminal__row\s*\{/,
  'Dashboard styles should define the terminal row treatment for the jobs list.',
);

assert.match(
  styleSource,
  /\.admin-jobs-terminal__group\s*\{/,
  'Dashboard styles should define grouped user sections inside the jobs terminal.',
);

assert.match(
  styleSource,
  /admin-jobs-terminal__group-list[\s\S]*max-height:\s*560px/,
  'Dashboard jobs should bound the historical stream height for predictable scrolling.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-jobs-terminal__status-badge\.is-completed[\s\S]*color:\s*#475569/,
  'Dashboard jobs should keep completed status pills readable in the light theme.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-jobs-command-deck__hero\s*\{/,
  'Dashboard jobs should define an explicit light-mode treatment for the command-deck hero.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-command-route--jobs \.admin-jobs-terminal__actions \.admin-shoe-filter\s*\{[\s\S]*?background:\s*#eef0f1 !important[\s\S]*?box-shadow:\s*none !important/,
  'Dashboard jobs status and type filters should use the requested light-grey surface.',
);

assert.match(
  styleSource,
  /\.admin-command-page \.admin-command-route--jobs \.admin-jobs-command-deck__spotlight-meta span\s*\{[^}]*display:\s*inline-flex[^}]*align-items:\s*center[^}]*justify-content:\s*center[^}]*text-align:\s*center/,
  'Jobs spotlight metadata pills should center their text within each grid.',
);

assert.match(
  styleSource,
  /#root \.admin-command-page \.admin-command-route--jobs \.admin-jobs-command-deck__workspace\s*\{[^}]*border:\s*0 !important[^}]*background:\s*transparent !important[^}]*box-shadow:\s*none !important[^}]*backdrop-filter:\s*none !important/,
  'The jobs split-workspace wrapper should stay surface-free while its list and detail cards remain independent.',
);

assert.match(
  translationsSource,
  /"jobs_deck_title":/,
  'Dashboard translations should include the jobs command-deck title copy.',
);

assert.match(
  translationsSource,
  /"jobs_deck_detail_title":/,
  'Dashboard translations should include the selected-job detail title copy.',
);

console.log('[PASS] Dashboard jobs command-deck guardrails passed.');
