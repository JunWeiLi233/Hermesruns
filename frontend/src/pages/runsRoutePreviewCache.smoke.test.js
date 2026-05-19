import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  runsSource,
  /function RoutePreviewThumb\(\{ preview, provider, runName \}\)/,
  'Runs route thumbnails should consume a preview model instead of requiring the full raw point list every time.',
);

assert.match(
  runsSource,
  /run\.routePreview/,
  'Runs page should use the server-provided cached route preview from the activities feed.',
);

assert.match(
  runsSource,
  /visibleRuns\.slice\(0,\s*50\)\.filter\(\(run\) => !run\.routePreview\)/,
  'Runs page should only fall back to point fetches for bounded currently listed runs that still lack a cached preview.',
);

assert.doesNotMatch(
  runsSource,
  /RoutePreviewThumb points=\{routePreviewPoints\[run\.id\] \|\| \[\]\}/,
  'Runs page should not keep rendering thumbnails only from raw point-array fallback state when a cached preview exists.',
);

assert.match(
  runsSource,
  /const RECENT_RUNS_INITIAL_VISIBLE_COUNT = 3;/,
  'Runs history should initially list exactly three recent runs before page-scroll expansion.',
);

assert.match(
  runsSource,
  /const RECENT_RUNS_LOAD_BATCH_SIZE = 6;/,
  'Runs history should load additional runs in bounded scroll batches.',
);

assert.match(
  runsSource,
  /filteredRuns\.slice\(0,\s*visibleRunsCount\)/,
  'Runs history should render a visible batch rather than mounting every filtered run immediately.',
);

assert.match(
  runsSource,
  /visibleRuns\.map\(\(run\) => \(/,
  'Runs history should render normal page-flow cards rather than a nested virtual scroller.',
);

assert.match(
  runsSource,
  /new IntersectionObserver\(\(entries\) => \{[\s\S]*setVisibleRunsCount\(\(current\) => Math\.min\(current \+ RECENT_RUNS_LOAD_BATCH_SIZE, filteredRuns\.length\)\)/,
  'Runs history should expand when page scrolling brings the loader sentinel into view.',
);

assert.doesNotMatch(
  runsSource,
  /from 'react-window'|<List|recent-runs-virtual-list|onRowsRendered|rowHeight=\{/,
  'Runs history should not use the nested react-window scroller or its internal scrollbar.',
);

assert.match(
  styleSource,
  /\.recent-runs-page-list\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*10px;/,
  'Runs page-flow list should have a normal card stack style.',
);

assert.doesNotMatch(
  styleSource,
  /\.recent-runs-virtual-list/,
  'Runs CSS should not keep the internal virtual-list scrollbar class.',
);

console.log('[PASS] Runs route preview cache guardrails passed.');
