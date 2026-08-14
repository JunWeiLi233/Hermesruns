import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');

function read(relativePath) {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const heatmapSource = read('pages/Heatmap.jsx');
const styleSource = read('styles/_split/heatmap.css');
const liquidGlassSource = read('styles/all-pages-liquid-glass.css');

assert(
  heatmapSource.includes("aria-label={t('heatmap.page_recenter')}"),
  'Heatmap map controls should keep an accessible label for the recenter interaction.',
);

assert(
  !heatmapSource.includes('heatmap-page-story-card')
    && !heatmapSource.includes('heatmap-page-focus-toggle')
    && !heatmapSource.includes('heatmap-sessions-summary-grid')
    && !heatmapSource.includes('heatmap-sessions-card')
    && !heatmapSource.includes('heatmap-sessions-list')
    && !styleSource.includes('.heatmap-page-story-card')
    && !styleSource.includes('.heatmap-page-focus-card')
    && !styleSource.includes('.heatmap-sessions-summary-grid')
    && !styleSource.includes('.heatmap-sessions-card')
    && !styleSource.includes('.heatmap-sessions-list'),
  'Heatmap should not render the retired story/focus overlay or the removed sessions drawer.',
);

assert(
  /@media\s+\(max-width:\s*920px\)\s*\{[\s\S]*\.heatmap-page-legend-card\s*\{[\s\S]*bottom:\s*92px;[\s\S]*max-height:\s*244px;[\s\S]*overflow-y:\s*auto;/,
  'Heatmap mobile legend should remain bounded above the utility rail.',
);

assert(
  /\.heatmap-page-utility-rail\s*\{[\s\S]*bottom:\s*18px;[\s\S]*grid-auto-flow:\s*column;[\s\S]*max-width:\s*calc\(100% - 32px\);/.test(styleSource),
  'Heatmap mobile utility rail should remain reachable as a bottom horizontal control strip.',
);

assert(
  /body:is\(\.theme-light, \.theme-midnight, \.theme-high-contrast\) \.heatmap-page \{[\s\S]*--heatmap-control-surface:[\s\S]*--heatmap-control-ink:/.test(liquidGlassSource),
  'Heatmap should establish opaque, high-contrast map-control tokens instead of inheriting translucent liquid glass.',
);

assert(
  /\.heatmap-page \.heatmap-page-topbar \{[\s\S]*background: linear-gradient\(110deg, rgba\(4, 8, 12, 0\.99\), rgba\(11, 18, 25, 0\.96\)\) !important;[\s\S]*backdrop-filter: none !important;/.test(liquidGlassSource),
  'Heatmap topbar should use an opaque instrument surface rather than a translucent glass band.',
);

assert(
  /\.heatmap-page \.heatmap-page-utility-btn\.is-active \{[\s\S]*background: linear-gradient\(135deg, #ff785f, #ff3f63\) !important;[\s\S]*color: #180c10 !important;/.test(liquidGlassSource),
  'The active Heatmap tool should retain a strongly visible coral state.',
);

assert(
  /\.heatmap-page :is\([\s\S]*\.heatmap-page-primary-btn,[\s\S]*\.heatmap-page-secondary-btn[\s\S]*\):focus-visible \{[\s\S]*outline: 3px solid #ffd166 !important;/.test(liquidGlassSource),
  'Heatmap controls should keep a high-contrast keyboard focus indicator over the map.',
);

console.log('[PASS] Heatmap mobile overlay guardrails passed.');
