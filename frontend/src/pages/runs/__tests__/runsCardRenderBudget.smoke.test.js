import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, "../Runs.jsx"), 'utf8');
const splitRunsStyle = readFileSync(path.join(here, "../../../styles/_split/runs.css"), 'utf8');
const bundledStyle = readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8');

// The Runs page must not mount a full history up front. Live measurement on
// production: 7,436 run-card DOM nodes, 2,404 <img> elements, a 35,337px-tall
// document, and 42 long tasks (worst 436ms) during the initial render. The
// page therefore renders in incremental batches (React mounting) and skips
// layout/paint of offscreen cards (CSS content-visibility).

assert.match(
  runsSource,
  /const RUNS_RENDER_BATCH_SIZE = 60;/,
  'Runs.jsx must pin the incremental render batch size at 60 cards.',
);

assert.match(
  runsSource,
  /const RECENT_RUNS_INITIAL_VISIBLE_COUNT = RUNS_RENDER_BATCH_SIZE;/,
  'The initial render window must be exactly one render batch.',
);

assert.match(
  runsSource,
  /const \[visibleRunsCount, setVisibleRunsCount\] = useState\(RECENT_RUNS_INITIAL_VISIBLE_COUNT\);/,
  'The rendered run count must live in dedicated state seeded from the batch size.',
);

assert.match(
  runsSource,
  /const visibleRuns = useMemo\(\s*\(\) => filteredRuns\.slice\(0,\s*visibleRunsCount\),\s*\[filteredRuns, visibleRunsCount\],\s*\);/,
  'The rendered cards must be a prefix slice of the same ordered filtered list, cut by the rendered-count state.',
);

assert.match(
  runsSource,
  /const hasMoreRuns = visibleRunsCount < filteredRuns\.length;/,
  'The page must track whether unrendered filtered runs remain.',
);

// IntersectionObserver sentinel wiring: created, attached to the sentinel,
// grows the window by one batch, and disconnects on completion and unmount.
assert.match(
  runsSource,
  /if \(!hasMoreRuns \|\| loadState !== 'ready'\) return undefined;/,
  'The sentinel observer must not be created once every filtered run is rendered (or while data is still loading).',
);

assert.match(
  runsSource,
  /const observer = new IntersectionObserver\(\(entries\) => \{[\s\S]*?setVisibleRunsCount\(\(current\) => Math\.min\(current \+ RUNS_RENDER_BATCH_SIZE, filteredRuns\.length\)\);[\s\S]*?\}, \{[\s\S]*?rootMargin: getRunsLoadMoreRootMargin\(window\.innerHeight\),[\s\S]*?\}\);/,
  'The sentinel observer must append exactly one render batch per intersection, clamped to the filtered list length.',
);

assert.match(
  runsSource,
  /observer\.observe\(sentinel\);/,
  'The observer must be attached to the load-more sentinel element.',
);

assert.match(
  runsSource,
  /return \(\) => observer\.disconnect\(\);[\s\S]*?\}, \[filteredRuns, hasMoreRuns, loadState, visibleRunsCount\]\);/,
  'The observer must disconnect on cleanup — when the final batch completes, when the filtered list changes, and on unmount.',
);

assert.match(
  runsSource,
  /<div ref=\{loadMoreSentinelRef\} className="recent-runs-load-more-sentinel"/,
  'The sentinel element must sit after the rendered run list and carry the observer ref.',
);

assert.match(
  runsSource,
  /useEffect\(\(\) => \{\s*setVisibleRunsCount\(RECENT_RUNS_INITIAL_VISIBLE_COUNT\);\s*\}, \[activeMode, runsSort, searchQuery, selectedMonth, selectedYear\]\);/,
  'Search/filter/sort changes must reset the render window so every matching card is reachable by scrolling again.',
);

assert.doesNotMatch(
  runsSource,
  /RUNS_BACKGROUND_LOAD_STEP_MS|setInterval/,
  'No background timer may keep mounting the whole history regardless of scroll — growth must stay scroll-driven.',
);

// CSS virtualization: offscreen run-card shells skip layout/paint.
assert.match(
  splitRunsStyle,
  /\.recent-runs-card-shell\s*\{[\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-size:\s*auto \d+px;/,
  'Split runs.css must let the browser skip layout/paint of offscreen run-card shells.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-card-shell\s*\{[\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-size:\s*auto \d+px;/,
  'The generated style bundle must mirror the run-card content-visibility rule.',
);

// The route-tile images must keep deferring their network + decode work.
assert.match(
  runsSource,
  /className="recent-runs-thumb-route-tile"[\s\S]*?loading="lazy"[\s\S]*?decoding="async"/,
  'Route-tile images must keep loading="lazy" and decoding="async".',
);

console.log('[PASS] Runs card render budget guardrails passed.');
