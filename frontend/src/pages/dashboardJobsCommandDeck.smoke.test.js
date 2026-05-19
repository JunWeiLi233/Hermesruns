import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const translationsSource = [
  '../i18n/translations.js',
  '../i18n/locales/en.js',
  '../i18n/locales/zh-CN.js',
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
  /body\.theme-light \.admin-command-page \.admin-jobs-command-deck__hero\s*\{/,
  'Dashboard jobs should define an explicit light-mode treatment for the command-deck hero.',
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
