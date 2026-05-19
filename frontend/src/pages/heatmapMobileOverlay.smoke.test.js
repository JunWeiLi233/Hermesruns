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
const styleSource = read('styles/style.css');

assert(
  heatmapSource.includes("aria-label={t('heatmap.page_focus_collapse')}")
    && heatmapSource.includes("aria-label={t('heatmap.page_focus_expand')}")
    && heatmapSource.includes("aria-label={t('heatmap.page_recenter')}"),
  'Heatmap map controls should keep accessible labels for collapse, expand, and recenter interactions.',
);

assert(
  /@media\s+\(max-width:\s*920px\)\s*\{[\s\S]*\.heatmap-sessions-card\s*\{[\s\S]*display:\s*none;[\s\S]*\.heatmap-page-story-card\s*\{[\s\S]*bottom:\s*356px;[\s\S]*max-height:\s*clamp\(180px,\s*30vh,\s*252px\);[\s\S]*overflow-y:\s*auto;[\s\S]*\.heatmap-page-legend-card\s*\{[\s\S]*bottom:\s*92px;[\s\S]*max-height:\s*244px;[\s\S]*overflow-y:\s*auto;/,
  'Heatmap mobile overlay stack should hide the optional sessions drawer and bound the story/legend cards above the utility rail.',
);

assert(
  /\.heatmap-page-utility-rail\s*\{[\s\S]*bottom:\s*18px;[\s\S]*grid-auto-flow:\s*column;[\s\S]*max-width:\s*calc\(100% - 32px\);/.test(styleSource),
  'Heatmap mobile utility rail should remain reachable as a bottom horizontal control strip.',
);

console.log('[PASS] Heatmap mobile overlay guardrails passed.');
