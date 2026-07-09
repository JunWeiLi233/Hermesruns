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

assert(
  heatmapSource.includes("aria-label={t('heatmap.page_recenter')}"),
  'Heatmap map controls should keep an accessible label for the recenter interaction.',
);

assert(
  !heatmapSource.includes('heatmap-page-story-card')
    && !heatmapSource.includes('heatmap-page-focus-toggle')
    && !styleSource.includes('.heatmap-page-story-card')
    && !styleSource.includes('.heatmap-page-focus-card'),
  'Heatmap should not render or style the retired story/focus card overlay.',
);

assert(
  /@media\s+\(max-width:\s*920px\)\s*\{[\s\S]*\.heatmap-sessions-card\s*\{[\s\S]*display:\s*none;[\s\S]*\.heatmap-page-legend-card\s*\{[\s\S]*bottom:\s*92px;[\s\S]*max-height:\s*244px;[\s\S]*overflow-y:\s*auto;/,
  'Heatmap mobile overlay stack should hide the optional sessions drawer and bound the legend card above the utility rail.',
);

assert(
  /\.heatmap-page-utility-rail\s*\{[\s\S]*bottom:\s*18px;[\s\S]*grid-auto-flow:\s*column;[\s\S]*max-width:\s*calc\(100% - 32px\);/.test(styleSource),
  'Heatmap mobile utility rail should remain reachable as a bottom horizontal control strip.',
);

console.log('[PASS] Heatmap mobile overlay guardrails passed.');
