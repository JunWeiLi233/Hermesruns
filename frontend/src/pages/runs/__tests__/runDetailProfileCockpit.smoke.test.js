import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');
const runDetailSource = read('pages/runs/RunDetail.jsx');
const styleSource = read('styles/run-detail-v2.css');
const minimalStyleSource = read('styles/run-detail-profile-minimal.css');
const appStyleSource = read('styles/app.css');

function section(startMarker, endMarker) {
  const start = runDetailSource.indexOf(startMarker);
  const end = runDetailSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'Run Detail should retain section boundaries: ' + startMarker);
  return runDetailSource.slice(start, end);
}

function rule(selector, source = styleSource) {
  const escaped = selector.replace(/[.*+?^()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
  assert.ok(match, 'Run Detail should retain CSS for ' + selector);
  return match[1];
}

function media(query) {
  const start = styleSource.indexOf('@media (' + query + ')');
  assert.ok(start >= 0, 'Run Detail should retain responsive rules for ' + query);
  const end = styleSource.indexOf('@media', start + 1);
  return styleSource.slice(start, end < 0 ? undefined : end);
}

const hero = section('<section id="run-detail-overview"', '{analytics?.debrief && (');
const coach = section('<section id="run-detail-coach"', '<section id="run-detail-telemetry"');
const telemetry = section('<section id="run-detail-telemetry"', '<div className="run-detail-v2__lower">');
const splits = section('<section id="run-detail-splits"', '<aside className="run-detail-v2__side">');
const gear = section('<section className="run-detail-v2__card run-detail-gear-section', '<section className="run-detail-v2__card run-detail-v2__effect">');

assert.match(
  runDetailSource,
  /className="run-detail-page run-detail-profile-cockpit run-detail-profile-minimal run-detail-v2"/,
  'Loaded Run Detail should opt into v2 while inheriting the Profile and runner-shell treatments.',
);
assert.ok(
  appStyleSource.includes("@import './run-detail-v2.css';")
    && appStyleSource.indexOf("@import './run-detail-v2.css';") > appStyleSource.indexOf("@import './run-detail-profile-minimal.css';")
    && appStyleSource.indexOf("@import './run-detail-profile-minimal.css';") > appStyleSource.indexOf("@import './loading-skeleton.css';"),
  'The runtime stylesheet should load v2 after the shared detail and loading layers.',
);
assert.match(read('App.jsx'), /import\('\.\/styles\/app\.css'\)/, 'The application should load the runtime style manifest.');

assert.match(
  runDetailSource,
  /runner-shell-page runner-dashboard-page runs-dashboard-page run-detail-runner-page run-detail-v2-page/,
  'Run Detail should remain inside the shared authenticated runner shell.',
);
assert.ok(
  runDetailSource.includes("activeKey: 'activities'")
    && runDetailSource.includes('<RunnerShellTopNav')
    && runDetailSource.includes('parentRoute="/runs"')
    && runDetailSource.includes('<RunsSubpageNav')
    && runDetailSource.includes('onSelectRun={handleSelectRecentRun}')
    && runDetailSource.includes('recentRuns={recentRuns}')
    && runDetailSource.includes('className="runner-shell-canvas"'),
  'Runs navigation, its breadcrumb, recent-run selection, and shared canvas should remain connected.',
);
assert.equal(
  (runDetailSource.match(/run-detail-page run-detail-profile-cockpit/g) || []).length,
  3,
  'Loading, empty, and loaded states should all retain the profile cockpit shell.',
);
assert.ok(
  runDetailSource.includes('<Link to="/runs">')
    && runDetailSource.includes("t('run_detail.no_run_selected')")
    && runDetailSource.includes('className="run-detail-loading-card" aria-live="polite"'),
  'Loading and empty states should remain recoverable through localized status and back navigation.',
);

assert.match(rule('#root .run-detail-v2 .run-detail-v2__hero'), /display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0, 1\.45fr\) minmax\(360px, 1fr\);/, 'The desktop hero should pair a contained route card with the activity summary.');
assert.match(rule('#root .run-detail-v2 .run-detail-v2__summary'), /min-width:\s*0;[\s\S]*background:\s*var\(--v2-card\);/, 'The hero summary should remain a distinct card that can shrink.');
assert.match(hero, /run-detail-v2__map[\s\S]*run-detail-v2__summary[\s\S]*<h1>\{run\.name \|\| t\('run_detail\.detail_title'\)\}/, 'Route and no-route activities should share the same localized activity heading and summary.');
assert.ok(
  ['metric_distance', 'metric_average_pace', 'metric_moving_time'].every((key) => hero.includes("t('run_detail." + key + "')"))
    && hero.includes('{distanceValue}<em>{distanceUnitLabel}</em>')
    && hero.includes('{paceMetricValue}')
    && hero.includes('{timeValue}')
    && hero.includes('secondaryMetrics.map((metric) =>'),
  'The summary should retain distance, pace, moving time, and secondary metrics with their values and units.',
);
assert.match(rule('#root .run-detail-v2 .run-detail-v2__primary'), /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, 'The hero should keep the three primary metrics together.');
assert.match(rule('#root .run-detail-v2 .run-detail-v2__heading h1'), /font-size:\s*clamp\(1\.8rem, 2\.6vw, 2\.4rem\);[\s\S]*overflow-wrap:\s*anywhere;/, 'Activity titles should use compact type and wrap long names.');
assert.ok(!runDetailSource.includes('run.location || insights?.centerLabel'), 'Activity metadata should not fall back to route-center coordinates.');
assert.match(hero, /onClick=\{handleShare\} aria-label=\{t\('run_detail\.share'\)\}[\s\S]*shareFeedback \|\| t\('run_detail\.share'\)/, 'Sharing should retain its handler, accessible label, and feedback.');
assert.match(runDetailSource, /if \(navigator\.share\)[\s\S]*await navigator\.share\([\s\S]*navigator\.clipboard\?\.writeText && url[\s\S]*await navigator\.clipboard\.writeText\(url\)/, 'Sharing should preserve both native sharing and clipboard fallback.');

assert.match(hero, /runComparison && \([\s\S]*id="run-detail-comparison"[\s\S]*run_comparison_faster[\s\S]*run_comparison_slower[\s\S]*run_comparison_same[\s\S]*run_comparison_basis/, 'The comparison should remain in the hero with direction and its recent-run basis.');
assert.ok(
  !runDetailSource.includes("runComparison.direction === 'slower' ? '-'")
    && !runDetailSource.includes("runComparison.direction === 'faster' ? '+'"),
  'Comparison should not reverse the meaning of faster and slower with signed badges.',
);
assert.match(coach, /analytics\.debrief\.readinessScore[\s\S]*analytics\.debrief\.interpretation[\s\S]*analytics\.debrief\.nextDayGuidance/, 'The separate coach strip should retain readiness, review, and next-day guidance.');
assert.match(rule('#root .run-detail-v2 .run-detail-v2__coach'), /grid-template-columns:\s*150px minmax\(0, 1\.3fr\) minmax\(0, 1fr\);[\s\S]*background:\s*var\(--v2-card\);/, 'Coach evidence should use the v2 card surface.');
assert.match(rule('#root .run-detail-v2 .run-detail-v2__coach-score strong'), /color:\s*var\(--v2-ink\);/, 'Readiness should remain readable on the coach card.');

assert.ok(
  runDetailSource.indexOf('<section id="run-detail-telemetry"') > runDetailSource.indexOf('<section id="run-detail-coach"')
    && runDetailSource.indexOf('<section id="run-detail-splits"') > runDetailSource.indexOf('<section id="run-detail-telemetry"'),
  'Full-width telemetry should follow the hero and coach strip, then lead into splits and the gear column.',
);
assert.match(telemetry, /className="run-detail-v2__card-head">\s*<h2>\{t\('run_detail\.telemetry_title'\)\}<\/h2>\s*<div className="run-detail-v2__tabs" role="tablist" aria-label=\{t\('run_detail\.telemetry_title'\)\}/, 'The localized telemetry heading and tablist should belong to one card.');
assert.match(telemetry, /type="button"[\s\S]*onClick=\{\(\) => setActiveTelemetryKey\(definition\.key\)\}[\s\S]*role="tab"\s*aria-selected=\{isActive\}/, 'Telemetry controls should switch their stream and expose the selected state.');
assert.match(telemetry, /formatTelemetryValue\(displaySample\.value, definition\.key\)[\s\S]*<em>\{definition\.unit\}<\/em>/, 'Telemetry tabs should retain measured values and units.');
assert.match(telemetry, /telemetryChartData \? \(\s*<Line data=\{telemetryChartData\} options=\{telemetryChartOptions\} \/>[\s\S]*run-detail-chart-empty.*telemetry_no_stream/, 'Available streams should render the chart and missing streams should show a localized fallback.');
assert.match(telemetry, /telemetryBounds \? \([\s\S]*telemetryBounds\.min[\s\S]*telemetryBounds\.max/, 'Telemetry should retain minimum and maximum readouts.');

assert.ok(
  ['heartRate', 'cadence', 'strideLength', 'groundContactTimeMs', 'verticalOscillationCm', 'elevation'].every((key) => runDetailSource.includes("key: '" + key + "'"))
    && runDetailSource.includes('const displaySample = getTelemetryDisplaySample(samples);')
    && runDetailSource.includes('const telemetryTabDefinitions = useMemo(() => telemetryDefinitions')
    && runDetailSource.includes('hasData: Boolean(displaySample)')
    && runDetailSource.includes('if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;'),
  'All six telemetry streams should remain selectable, ordered with measured streams first.',
);
assert.ok(
  /apiFetch\(\x60\/api\/activities\/\$\{runId\}\/telemetry\x60\)/.test(runDetailSource)
    && /const TELEMETRY_CHART_SAMPLE_INTERVAL_SECONDS = 0\.1;/.test(runDetailSource)
    && /const TELEMETRY_CHART_RENDER_POINT_BUDGET = 12000;/.test(runDetailSource)
    && runDetailSource.includes('Decimation')
    && runDetailSource.includes('function resampleTelemetrySamples')
    && runDetailSource.includes('function getTelemetryValueBounds')
    && runDetailSource.includes('tick += tickStep')
    && runDetailSource.includes('function formatTelemetryInteractionTime')
    && runDetailSource.includes('activeTelemetryChartSamples.map((sample) => ({ x: sample.t, y: sample.value }))')
    && runDetailSource.includes('parsing: false')
    && runDetailSource.includes('normalized: true')
    && runDetailSource.includes('animation: false')
    && runDetailSource.includes('decimation: {')
    && runDetailSource.includes("type: 'linear'")
    && runDetailSource.includes('title: (items) => formatTelemetryInteractionTime(items?.[0]?.parsed?.x)')
    && telemetry.includes('time: formatTelemetryInteractionTime(focusTelemetryPoint.t)')
    && !runDetailSource.includes('Math.min(...values)')
    && !runDetailSource.includes('Math.max(...values)'),
  'Telemetry should preserve bounded 0.1-second sampling, linear time, decimation, whole-second interaction labels, and safe dense-stream bounds.',
);
assert.ok(
  !runDetailSource.includes("t('run_detail.route_center_marker')")
    && !runDetailSource.includes("t('run_detail.route_center')")
    && !runDetailSource.includes("t('run_detail.telemetry_subtitle')")
    && !runDetailSource.includes('run-detail-telemetry-resolution')
    && !runDetailSource.includes('samples.length ? samples.length.toLocaleString()')
    && !runDetailSource.includes("t('run_detail.decoupling')")
    && !runDetailSource.includes('trainingEffect?.basis')
    && !runDetailSource.includes('training_' + 'effect_estimated'),
  'Telemetry should retain the removal of route-center labels, sample counts, and obsolete device explanations.',
);
assert.match(telemetry, /elevationStatus\?\.flagged && \([\s\S]*elevationStatus\?\.canRecalibrate && \([\s\S]*disabled=\{recalibratingElevation\} onClick=\{handleElevationRecalibration\}/, 'Flagged elevation should retain the supported recalibration control and busy state.');

assert.match(splits, /run-detail-v2__card-head[\s\S]*t\('run_detail\.splits'\)[\s\S]*lapRows\.length > 5 && \([\s\S]*onClick=\{\(\) => setShowAllSplits\(\(prev\) => !prev\)\}[\s\S]*showAllSplits \? t\('run_detail\.show_less'\) : t\('run_detail\.view_all'\)[\s\S]*<table className="run-detail-splits-table run-detail-v2__splits-table">/, 'The split heading, expand/collapse control, and table should remain in one card.');
assert.match(runDetailSource, /const visibleLapRows = showAllSplits \? lapRows : lapRows\.slice\(0, 5\)/, 'Splits should show five rows until the runner requests all laps.');
assert.match(splits, /visibleLapRows\.map[\s\S]*fastestVisibleLapIndex[\s\S]*lapBarWidth\(visibleLapPaces\[index\]\)[\s\S]*lap\.pace \|\| '--'[\s\S]*lapGain != null[\s\S]*lap\.averageHeartRate \? Math\.round\(lap\.averageHeartRate\) : '--'/, 'Split rows should preserve pace bars, fastest-lap emphasis, elevation, and missing-heart-rate fallback.');
assert.match(splits, /colSpan="5" className="is-empty">\{t\('run_detail\.no_lap_data'\)\}/, 'Missing splits should retain a localized table fallback.');
assert.ok(!runDetailSource.includes('lap.averageHeartRate || 0'), 'Missing split heart rate should not become a false zero.');
assert.match(rule('#root .run-detail-runner-page .run-detail-v2 .run-detail-v2__splits-table td'), /background:\s*transparent !important;[\s\S]*color:\s*var\(--v2-ink\) !important;/, 'Splits should retain uniform card rows and readable text.');
assert.match(rule('#root .run-detail-runner-page .run-detail-v2 tr.is-highlight .run-detail-v2__pace'), /color:\s*var\(--v2-accent\) !important;/, 'The fastest split should remain visually identifiable.');

assert.ok(
  /apiJson\(\x60\/api\/shoes\/\$\{normalizedShoeId\}\/assign\/\$\{run\.id\}\x60, \{ method: 'PATCH' \}\)/.test(runDetailSource)
    && !/apiFetch\(\x60\/api\/shoes\/\$\{normalizedShoeId\}\/assign\/\$\{run\.id\}\x60, \{ method: 'PATCH' \}\)/.test(runDetailSource)
    && runDetailSource.includes('response?.activityId != null && String(response.activityId) !== String(run.id)')
    && runDetailSource.includes("setShoeActionMessage(t('run_detail.shoe_assign_failed'))")
    && runDetailSource.includes('setShoeDropdownOpen(false);'),
  'Shoe assignment should validate the API response, expose failure, and close the picker after success.',
);
assert.match(gear, /t\('run_detail\.gear_linked'\)[\s\S]*disabled=\{assigningShoeId != null\}[\s\S]*setShoeDropdownOpen\(\(prev\) => !prev\)[\s\S]*t\('run_detail\.change_shoe'\) : t\('run_detail\.link_shoe'\)/, 'Gear controls should retain linking, changing, and busy-state handling.');
assert.match(gear, /run\.shoeId && \([\s\S]*disabled=\{assigningShoeId != null\} onClick=\{\(\) => assignShoe\(0\)\}/, 'Linked shoes should retain the unlink control.');
assert.match(gear, /shoeDropdownOpen && \([\s\S]*role="menu"[\s\S]*activeShoes\.length > 0 \? activeShoes\.map[\s\S]*onClick=\{\(\) => assignShoe\(shoe\.id\)\}[\s\S]*t\('run_detail\.no_active_shoes'\)/, 'The picker should assign the selected active shoe and retain its empty state.');
assert.match(gear, /linkedShoeName \|\| t\('run_detail\.no_shoe'\)[\s\S]*linkedShoeMileage[\s\S]*linkedShoeUsage[\s\S]*shoeActionMessage[\s\S]*aria-live="polite"/, 'Gear should retain shoe identity, mileage, usage, and live assignment feedback.');
assert.match(rule('#root .run-detail-runner-page .run-detail-v2 .run-detail-v2__gear .run-detail-gear-row'), /grid-template-columns:\s*72px minmax\(0, 1fr\) !important;/, 'The gear card should keep a compact image and readable shoe information.');
assert.match(runDetailSource, /trainingEffectAvailable \? value\.toFixed\(1\) : '--'[\s\S]*training_effect_unavailable[\s\S]*latestGroundContact[\s\S]*not_captured[\s\S]*latestVerticalOscillation[\s\S]*not_captured/, 'Training effect and running form should retain honest unavailable-device fallbacks.');
assert.ok(
  !runDetailSource.includes("t('run_detail.route_intelligence')")
    && !runDetailSource.includes("t('run_detail.analysis_notes')")
    && !runDetailSource.includes('run-detail-efficiency-panel')
    && !runDetailSource.includes('run-detail-data-quality-panel'),
  'The obsolete route intelligence, efficiency, and data-quality panels should stay removed.',
);

assert.match(rule('#root .run-detail-v2 .run-detail-v2__card'), /min-width:\s*0;[\s\S]*background:\s*var\(--v2-card\) !important;[\s\S]*box-shadow:\s*none !important;/, 'Telemetry, splits, and gear should share the v2 card treatment.');
assert.match(rule('.run-detail-profile-minimal', minimalStyleSource), /--run-detail-card:\s*#ffffff;[\s\S]*--run-detail-ink:\s*#1c1917;[\s\S]*--run-detail-accent:\s*var\(--brand-accent, #a0392a\);[\s\S]*background:\s*transparent !important;/, 'Run Detail should inherit Profile card, ink, and accent tokens on a transparent canvas.');
assert.match(rule('body:is(.theme-midnight, .theme-high-contrast) .run-detail-profile-minimal', minimalStyleSource), /--run-detail-card:[\s\S]*--run-detail-ink:[\s\S]*--run-detail-accent:/, 'The inherited Profile surface should retain dark-mode card and text tokens.');
assert.match(rule('body:is(.theme-midnight, .theme-high-contrast) #root .run-detail-runner-page .run-detail-page.run-detail-v2'), /--v2-muted:[\s\S]*--v2-line:[\s\S]*--v2-map:[\s\S]*--v2-seg-active:/, 'V2 should adapt muted text, dividers, maps, and active tabs for dark themes.');
assert.match(rule('.run-detail-profile-minimal :is(button, a):focus-visible', minimalStyleSource), /outline:\s*2px solid var\(--run-detail-accent\);/, 'All v2 buttons and links should inherit visible keyboard focus.');
assert.match(minimalStyleSource, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.run-detail-profile-minimal\s*\{\s*animation: none;\s*\}\s*\.run-detail-profile-minimal :is\(button, a\)\s*\{\s*transition: none;/, 'The v2 page and controls should retain reduced-motion support.');

assert.match(media('max-width: 1200px'), /\.run-detail-v2__hero,\s*#root \.run-detail-v2 \.run-detail-v2__lower\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/, 'The hero and lower grid should stack at tablet widths.');
assert.match(media('max-width: 860px'), /\.run-detail-v2__telemetry-stage\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/, 'Narrow-screen telemetry should stack its readout and chart.');
assert.match(media('max-width: 860px'), /\.run-detail-v2__coach\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/, 'Narrow-screen coach evidence should stack.');
assert.match(media('max-width: 860px'), /\.run-detail-v2__secondary\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/, 'Secondary metrics should use two columns on narrow screens.');
assert.match(media('max-width: 520px'), /\.run-detail-v2__primary\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/, 'Primary metrics should stack on small phones.');

console.log('[PASS] Run Detail v2 profile cockpit guardrails passed.');
