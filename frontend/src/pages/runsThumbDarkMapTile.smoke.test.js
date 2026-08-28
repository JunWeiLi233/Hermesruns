import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const splitRunsStyle = readFileSync(path.join(here, '../styles/_split/runs.css'), 'utf8');
const bundledStyle = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');

// The run-thumbnail must render a concrete dark real-world map tile under the
// SVG route — runners shouldn't have to imagine where the run happened.

assert.match(
  runsSource,
  /buildRouteTileLayers/,
  'Runs page should compute positioned dark tile layers for each run thumbnail bbox.',
);

assert.match(
  runsSource,
  /\/api\/maps\/tiles\/esri-dark\/\$\{zoom\}\/\$\{y\}\/\$\{x\}\.png/,
  'Runs page must source thumbnail tiles from the same-origin Esri Dark Gray proxy so the orange route keeps its dark basemap on every visitor network.',
);

assert.doesNotMatch(
  runsSource,
  /basemaps\.cartocdn\.com|dark_nolabels|server\.arcgisonline\.com/,
  'Runs page must not load thumbnail tiles from third-party hosts: CARTO watermarks anonymous requests, and direct Esri hosts are unreachable from some visitor networks.',
);

assert.match(
  runsSource,
  /recent-runs-thumb-route-tile/,
  'Runs page should render a recent-runs-thumb-route-tile element when bbox is available.',
);

assert.match(
  runsSource,
  /data-route-tile-layer/,
  'Runs page should expose route tile layer ids so runtime proof can distinguish grid tiles from one stretched image.',
);

assert.match(
  runsSource,
  /tileRangeForPreviewBounds/,
  'Runs page should derive the tile grid from the same preview bounds used by the SVG route frame.',
);

assert.match(
  runsSource,
  /ROUTE_TILE_TARGET_CSS_PX\s*=\s*128/,
  'Runs page should pick route-thumbnail map zoom from displayed tile pixel density, not a single oversized low-zoom tile.',
);

assert.match(
  runsSource,
  /function pickRouteTileZoomForViewport\(viewBounds,\s*viewportSize/,
  'Runs page should choose street-level tile zoom from the final viewport bounds and rendered thumbnail size.',
);

assert.match(
  runsSource,
  /latToWorldY/,
  'Runs page should project thumbnail route latitude into Web Mercator world coordinates, matching Leaflet/CARTO tiles.',
);

assert.match(
  runsSource,
  /mapFrame/,
  'Runs page should carry a Mercator mapFrame with point-derived previews so the SVG path and background tile grid share coordinates.',
);

assert.match(
  runsSource,
  /mercatorPoints:\s*projected/,
  'Point-derived previews should retain Mercator points so the route path can be regenerated from the rendered map viewport.',
);

assert.match(
  runsSource,
  /function buildRouteViewportFrame\(routeFrame,\s*viewportAspect/,
  'Route thumbnails should expand the route frame to the rendered thumbnail aspect ratio before placing tiles.',
);

assert.match(
  runsSource,
  /const ROUTE_PREVIEW_PADDING = 24;/,
  'Runs page should reserve enough preview padding so every route footprint stays compact inside thumbnails.',
);

assert.match(
  runsSource,
  /const viewportAspect = thumbSize\?\.width && thumbSize\?\.height[\s\S]*thumbSize\.width \/ thumbSize\.height/,
  'Route thumbnails should use the actual rendered thumbnail aspect ratio, not a fixed square route frame.',
);

assert.match(
  runsSource,
  /buildMercatorPreviewPath\(normalizedPreview\.mercatorPoints,\s*viewportFrame\)/,
  'Route thumbnails should regenerate the SVG route from the same aspect-aware viewport frame as the map tiles.',
);

assert.match(
  runsSource,
  /buildRouteTileLayers\(viewportFrame,\s*thumbSize\)/,
  'Route thumbnails should build background tiles from the final viewport frame and rendered thumbnail size shared with recent-runs-thumb-route-svg.',
);

assert.match(
  runsSource,
  /preserveAspectRatio="none"/,
  'The route SVG should stretch its 100x100 preview coordinates exactly over the positioned tile layer frame.',
);

assert.match(
  runsSource,
  /recent-runs-thumb-route-point recent-runs-thumb-route-start/,
  'Runs page should render the thumbnail start marker as a circular overlay point.',
);

assert.match(
  runsSource,
  /recent-runs-thumb-route-point recent-runs-thumb-route-finish/,
  'Runs page should render the thumbnail finish marker as a circular overlay point.',
);

assert.doesNotMatch(
  runsSource,
  /<circle className="recent-runs-thumb-route-(start|finish)"/,
  'Runs page must not render start/end markers as SVG circles because preserveAspectRatio="none" stretches them into ovals.',
);

assert.doesNotMatch(
  runsSource,
  /const\s+tileUrl\s*=\s*resolvedBbox\s*\?\s*buildRouteTileUrl\(resolvedBbox\)/,
  'Runs page must not regress to a single centered tile stretched under the route SVG.',
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
  /apiJson\(`\/api\/activities\/route-previews\?\$\{params\.toString\(\)\}`\)/,
  'Runs page should batch-load visible thumbnail preview metadata through the route-previews endpoint.',
);

assert.doesNotMatch(
  runsSource,
  /apiFetch\(`\/api\/activities\/\$\{run\.id\}\/points`\)/,
  'Runs page should not hydrate each thumbnail through its own /points fetch once the batch preview endpoint exists.',
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
  /\.recent-runs-thumb-route-tile\s*\{[\s\S]*z-index:\s*0;/,
  'Split runs.css should keep the real-world map tile layer below the route SVG.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-route-tile\s*\{[\s\S]*object-fit:\s*fill/,
  'Split runs.css should let route tile layers fill their computed rectangles.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-route-tile\s*\{[\s\S]*max-width:\s*none;[\s\S]*max-height:\s*none;/,
  'Split runs.css should opt route tile layers out of global responsive image caps so percentage tile geometry is honored.',
);

assert.doesNotMatch(
  splitRunsStyle,
  /\.recent-runs-thumb-route-tile\s*\{[\s\S]*inset:\s*0;[\s\S]*object-fit:\s*cover/,
  'Split runs.css must not force the route tile grid back into one cover-stretched thumbnail image.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-route-svg\s*\{[\s\S]*z-index:\s*2;/,
  'Split runs.css should keep the route SVG explicitly above the real-world map tile image.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-route-shadow\s*\{[\s\S]*stroke-width:\s*3;[\s\S]*vector-effect:\s*non-scaling-stroke;/,
  'Split runs.css should keep the thumbnail route glow compact instead of oversized.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-route-line\s*\{[\s\S]*stroke-width:\s*1\.6;[\s\S]*vector-effect:\s*non-scaling-stroke;/,
  'Split runs.css should render a compact route line over the thumbnail map.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-route-point\s*\{[\s\S]*width:\s*6px;[\s\S]*height:\s*6px;[\s\S]*border-radius:\s*999px;[\s\S]*transform:\s*translate\(-50%,\s*-50%\);/,
  'Split runs.css should make route endpoint overlays real circles that are centered on route coordinates.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-route-finish\s*\{[\s\S]*width:\s*7px;[\s\S]*height:\s*7px;/,
  'Split runs.css should keep the finish endpoint slightly emphasized but still compact.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb-badge\s*\{[\s\S]*z-index:\s*3;/,
  'Split runs.css should keep the Strava/source badge above the route SVG overlay.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-route-tile/,
  'Bundled style.css must mirror the split-css rule so the live bundle includes the tile styling.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-route-tile\s*\{[\s\S]*object-fit:\s*fill/,
  'Bundled style.css should mirror the tile-layer fill rule.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-route-tile\s*\{[\s\S]*max-width:\s*none;[\s\S]*max-height:\s*none;/,
  'Bundled style.css should mirror the global-image-cap override for tile layers.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-route-svg\s*\{[\s\S]*z-index:\s*2;/,
  'Bundled style.css should mirror the explicit route-over-map z-index.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-route-shadow\s*\{[\s\S]*stroke-width:\s*3;[\s\S]*vector-effect:\s*non-scaling-stroke;/,
  'Bundled style.css should mirror the compact route glow width.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-route-line\s*\{[\s\S]*stroke-width:\s*1\.6;[\s\S]*vector-effect:\s*non-scaling-stroke;/,
  'Bundled style.css should mirror the compact route line width.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-route-point\s*\{[\s\S]*width:\s*6px;[\s\S]*height:\s*6px;[\s\S]*border-radius:\s*999px;[\s\S]*transform:\s*translate\(-50%,\s*-50%\);/,
  'Bundled style.css should mirror circular endpoint overlay styling.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-route-finish\s*\{[\s\S]*width:\s*7px;[\s\S]*height:\s*7px;/,
  'Bundled style.css should mirror the compact finish endpoint styling.',
);

assert.match(
  bundledStyle,
  /\.recent-runs-thumb-badge\s*\{[\s\S]*z-index:\s*3;/,
  'Bundled style.css should mirror the source badge overlay layer above the route SVG.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb\.is-route-preview,\s*\.recent-runs-thumb\.has-route-tile\s*\{[\s\S]*background:\s*#15171c/,
  'Split runs.css should keep every route-preview thumbnail on the dark map surface, even before tile images finish painting.',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-thumb\.is-route-preview,\s*\.recent-runs-thumb\.has-route-tile\s*\{[\s\S]*background:\s*#15171c/,
  'Split runs.css should keep route previews on the calm dark base, including when tile images are still pending.',
);

assert.match(
  bundledStyle,
  /body\.theme-light \.recent-runs-thumb\.is-route-preview,\s*body\.theme-light \.recent-runs-thumb\.has-route-tile\s*\{[\s\S]*background:\s*#15171c/,
  'Bundled style.css should keep route-preview thumbnails dark in light theme instead of letting the pale fallback override them.',
);
