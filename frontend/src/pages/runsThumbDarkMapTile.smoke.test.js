import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const splitRunsStyle = readFileSync(path.join(here, '../styles/_split/runs.css'), 'utf8');
const bundledStyle = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

// The run-thumbnail must render a concrete dark real-world map tile under the
// SVG route — runners shouldn't have to imagine where the run happened.

assert.match(
  runsSource,
  /buildRouteTileUrl/,
  'Runs page should compute a CartoDB dark tile URL for each run thumbnail bbox.',
);

assert.match(
  runsSource,
  /dark_nolabels/,
  'Runs page must use the dark_nolabels CartoDB tile style so the orange route stays the focal point.',
);

assert.match(
  runsSource,
  /basemaps\.cartocdn\.com/,
  'Runs page should source thumbnail tiles from the same CartoDB CDN used by Heatmap and Territory pages.',
);

assert.match(
  runsSource,
  /recent-runs-thumb-route-tile/,
  'Runs page should render a recent-runs-thumb-route-tile element when bbox is available.',
);

assert.match(
  runsSource,
  /computeBboxFromPoints/,
  'Runs page should derive a geographic bbox from raw lat/lng points so thumbnails can render real-world tiles.',
);

assert.match(
  runsSource,
  /readBboxCache|writeBboxCache/,
  'Runs page should cache the per-run bbox in localStorage so reloads do not re-fetch the point list.',
);

assert.match(
  runsSource,
  /routeBboxes/,
  'RunCard should accept a routeBboxes map and forward the bbox into the thumb.',
);

assert.match(
  runsSource,
  /<RoutePreviewThumb[^>]*bbox=/s,
  'RunCard should pass an explicit bbox prop into RoutePreviewThumb.',
);

// The route line/SVG must stay visually above the tile.
assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-route-tile\s*\{[\s\S]*position:\s*absolute/,
  'Split runs.css should position the route tile absolutely under the SVG route.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-route-svg\s*\{[\s\S]*z-index/,
  'Split runs.css should give the route SVG a z-index so it sits above the tile image.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-route-tile/,
  'Bundled style.css must mirror the split-css rule so the live bundle includes the tile styling.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb\.has-route-tile\s*\{[\s\S]*background:\s*#15171c/,
  'Split runs.css should swap the abstract gradient for a calm dark base when a tile is present (avoids loading flash).',
);
