import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const translationsSource = readFileSync(path.join(here, '../i18n/translations.js'), 'utf8');

assert.match(
  dashboardSource,
  /apiJson\(`\/api\/admin\/jobs\/\$\{selectedJobId\}`/,
  'Dashboard jobs inspector should fetch the selected job detail endpoint instead of relying only on the list row.',
);

assert.match(
  dashboardSource,
  /getDashboardJobParsedDetails/,
  'Dashboard jobs inspector should parse detailsJson for structured inspection.',
);

assert.match(
  dashboardSource,
  /admin-jobs-detail__timeline/,
  'Dashboard jobs inspector should render a per-job timeline panel for watcher steps.',
);

assert.match(
  dashboardSource,
  /admin-jobs-detail__payload-grid/,
  'Dashboard jobs inspector should render parsed payload highlights outside the raw JSON block.',
);

assert.match(
  styleSource,
  /\.admin-jobs-detail__timeline\s*\{/,
  'Dashboard styles should define the jobs inspector timeline layout.',
);

assert.match(
  styleSource,
  /\.admin-jobs-detail__timeline\s*\{[\s\S]*?min-width:\s*0;/,
  'Dashboard timeline grid should be allowed to shrink inside the inspector panel.',
);

assert.match(
  styleSource,
  /\.admin-jobs-detail__timeline-main p\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/,
  'Dashboard timeline messages should wrap long words instead of overflowing.',
);

assert.match(
  styleSource,
  /\.admin-jobs-detail__timeline-details span\s*\{[\s\S]*?flex:\s*1 1 180px;[\s\S]*?overflow-wrap:\s*anywhere;/,
  'Dashboard timeline detail chips should flex-wrap and contain long values without collapsing the page.',
);

assert.match(
  styleSource,
  /\.admin-jobs-detail__payload-grid\s*\{/,
  'Dashboard styles should define the jobs inspector payload highlight grid.',
);

assert.match(
  translationsSource,
  /"jobs_deck_detail_timeline":/,
  'Dashboard translations should include the jobs inspector timeline title.',
);

assert.match(
  translationsSource,
  /"jobs_deck_detail_payload_highlights":/,
  'Dashboard translations should include the jobs inspector payload highlights title.',
);

console.log('[PASS] Dashboard jobs inspector guardrails passed.');
