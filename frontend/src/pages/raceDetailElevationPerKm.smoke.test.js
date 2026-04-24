import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, 'RacesDetail.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  racesDetailSource,
  /function buildElevationDistanceMarks\(/,
  'Race detail should derive chart positions from kilometer-aware elevation marks.',
);

assert.match(
  racesDetailSource,
  /ELEVATION_SAMPLE_INTERVAL_KM\s*=\s*0\.05/,
  'Race detail should model the elevation curve at 0.05 km spacing.',
);

assert.doesNotMatch(
  racesDetailSource,
  /\['S', '10', '21', '30', 'F'\]/,
  'Race detail should not fall back to the old fixed checkpoint marker labels.',
);

assert.match(
  racesDetailSource,
  /points\.filter\(/,
  'Race detail should keep the visible marker set sparser than the full elevation sample set.',
);

assert.match(
  racesDetailSource,
  /race-detail-elevation-stage/,
  'Race detail should render the elevation chart inside a scrollable stage for dense per-km markers.',
);

assert.match(
  racesDetailSource,
  /raceDetailElevationChartRef/,
  'Race detail should keep a dedicated chart viewport ref so the initial view can be centered.',
);

assert.match(
  racesDetailSource,
  /raceDetailElevationStageRef/,
  'Race detail should keep a dedicated elevation stage ref so recentering can follow the true chart width.',
);

assert.match(
  racesDetailSource,
  /midpointPoint.*elevationGraph\.points\[Math\.floor\(elevationGraph\.points\.length \/ 2\)\]/s,
  'Race detail should derive the initial chart focus from the midpoint of the course distance.',
);

assert.match(
  racesDetailSource,
  /chartViewport\.scrollLeft\s*=\s*targetScrollLeft/,
  'Race detail should move the elevation chart viewport to the computed central-distance position on first load.',
);

assert.match(
  racesDetailSource,
  /ResizeObserver/,
  'Race detail should re-center the elevation chart after the viewport or chart stage finishes resizing.',
);

assert.match(
  racesDetailSource,
  /resizeObserver\.observe\(chartStage\)/,
  'Race detail should observe the inner elevation stage so late width changes still recenter the chart.',
);

assert.match(
  racesDetailSource,
  /activeElevationPoint\.y\s*<=\s*\d+\s*\?\s*' is-below'\s*:\s*''/,
  'Race detail should flip the elevation tooltip below the point when the peak is too close to the top edge.',
);

assert.match(
  styleSource,
  /\.race-detail-elevation-stage\s*\{/,
  'Styles should define the dedicated elevation stage wrapper.',
);

assert.match(
  styleSource,
  /overflow-x:\s*auto;/,
  'Styles should allow horizontal scroll when per-km markers need more width.',
);

assert.match(
  styleSource,
  /\.race-detail-elevation-tooltip\.is-below\s*\{/,
  'Styles should define a below-point tooltip position for high-elevation peaks.',
);

assert.match(
  styleSource,
  /\.race-detail-command-strip\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.08fr\)\s+minmax\(320px,\s*0\.92fr\);/m,
  'Race detail command strip should keep the coach insight beside the predicted-time stats.',
);

assert.match(
  styleSource,
  /\.race-detail-stats\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/m,
  'Race detail stats grid should stay a focused two-card row instead of stretching with the wider chart changes.',
);

console.log('[PASS] Race detail elevation per-km guardrails passed.');
