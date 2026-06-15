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

const runDetailSource = read('pages/RunDetail.jsx');
const appIconSource = read('components/AppIcon.jsx');
const styleSource = read('styles/style.css');
const splitRunsStyleSource = read('styles/_split/runs.css');
const splitLightThemeStyleSource = read('styles/_split/light-theme-overrides.css');

assert(
  (runDetailSource.match(/run-detail-page run-detail-profile-cockpit/g) || []).length >= 3,
  'Run Detail loading, empty, and loaded states should all opt into the profile cockpit shell.',
);

assert(
  runDetailSource.includes('run-detail-hero-grid run-detail-profile-hero')
    && runDetailSource.includes('run-detail-map-card run-detail-profile-map')
    && runDetailSource.includes('run-detail-stat-rail run-detail-profile-stat-rail')
    && !runDetailSource.includes('run.locationCity || run.city || run.locationName || run.location || insights?.centerLabel'),
  'Run Detail should render the profile hero, map, and stat-rail hooks targeted by the profile CSS, and the topbar metadata should not fall back to coordinate labels.',
);

assert(
  runDetailSource.includes('<Link to="/runs"')
    && runDetailSource.includes("aria-label={t('run_detail.back_to_runs')}")
    && runDetailSource.includes("t('run_detail.no_run_selected')")
    && !runDetailSource.includes('run-detail-debrief-icon')
    && !runDetailSource.includes("name=\"coach_voice\""),
  'Run Detail redesign must preserve back navigation and the recoverable empty state while removing the debrief icon.',
);

assert(
  runDetailSource.includes('/telemetry')
    && runDetailSource.includes("activeTelemetryKey")
    && runDetailSource.includes("run-detail-telemetry-section")
    && runDetailSource.includes("groundContactTimeMs")
    && runDetailSource.includes("verticalOscillationCm")
    && !runDetailSource.includes("t('run_detail.route_center_marker')")
    && !runDetailSource.includes("t('run_detail.route_center')")
    && runDetailSource.includes('const TELEMETRY_CHART_SAMPLE_INTERVAL_SECONDS = 0.1')
    && runDetailSource.includes('const TELEMETRY_CHART_RENDER_POINT_BUDGET = 12000')
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
    && runDetailSource.includes('time: formatTelemetryInteractionTime(focusTelemetryPoint.t)')
    && !runDetailSource.includes('Math.min(...values)')
    && !runDetailSource.includes('Math.max(...values)'),
  'Run Detail should fetch telemetry streams, render the chart on a bounded 0.1-second linear time scale, keep hover/readout time at whole seconds, avoid dense-stream min/max spread work, and keep the route-center marker/label removed.',
);

assert(
  runDetailSource.includes("apiJson(`/api/shoes/${normalizedShoeId}/assign/${run.id}`, { method: 'PATCH' })")
    && !runDetailSource.includes("apiFetch(`/api/shoes/${normalizedShoeId}/assign/${run.id}`, { method: 'PATCH' })")
    && runDetailSource.includes("response?.activityId != null && String(response.activityId) !== String(run.id)")
    && runDetailSource.includes("setShoeActionMessage(t('run_detail.shoe_assign_failed'))")
    && runDetailSource.includes("t('run_detail.no_active_shoes')")
    && runDetailSource.includes('activeShoes.length > 0 ? activeShoes.map')
    && runDetailSource.includes('setShoeDropdownOpen(false);'),
  'Run Detail shoe linking should validate the assignment response, expose failures, and show an empty shoe picker state.',
);

assert(
  /\.run-detail-gear-copy\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(styleSource)
    && /\.run-detail-gear-actions\s*\{[\s\S]*grid-column:\s*1;[\s\S]*justify-self:\s*stretch;[\s\S]*width:\s*100%;[\s\S]*margin-top:\s*12px;/.test(styleSource)
    && /\.run-detail-gear-actions\s+\.run-detail-link-btn\s*\{[\s\S]*flex:\s*1\s+1\s+0;[\s\S]*border-radius:\s*999px;[\s\S]*white-space:\s*nowrap;/.test(styleSource)
    && /\.run-detail-gear-panel\s*>\s*\.run-detail-gear-actions,[\s\S]*\.run-detail-gear-panel\s*>\s*\.run-detail-dropdown,[\s\S]*\.run-detail-gear-panel\s*>\s*\.run-detail-gear-status\s*\{[\s\S]*margin-left:\s*0;[\s\S]*width:\s*100%;/.test(styleSource)
    && /\.shoe-run-dropdown\.run-detail-dropdown\s*\{[\s\S]*position:\s*static;[\s\S]*left:\s*auto;[\s\S]*top:\s*auto;/.test(styleSource)
    && /body\.theme-light\s+\.run-detail-gear-actions\s+\.run-detail-link-btn,[\s\S]*body\.theme-high-contrast-light\s+\.run-detail-gear-actions\s+\.run-detail-link-btn\s*\{[\s\S]*background:\s*var\(--runner-profile-ink,\s*#17130f\);/.test(styleSource)
    && /<\/div>\s*<\/div>\s*<div className="run-detail-gear-actions">/.test(runDetailSource)
    && /\.run-detail-gear-copy\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(splitRunsStyleSource)
    && /\.run-detail-gear-actions\s*\{[\s\S]*grid-column:\s*1;[\s\S]*justify-self:\s*stretch;[\s\S]*width:\s*100%;[\s\S]*margin-top:\s*12px;/.test(splitRunsStyleSource)
    && /\.run-detail-gear-actions\s+\.run-detail-link-btn\s*\{[\s\S]*flex:\s*1\s+1\s+0;[\s\S]*border-radius:\s*999px;[\s\S]*white-space:\s*nowrap;/.test(splitRunsStyleSource)
    && /\.run-detail-gear-panel\s*>\s*\.run-detail-gear-actions,[\s\S]*\.run-detail-gear-panel\s*>\s*\.run-detail-dropdown,[\s\S]*\.run-detail-gear-panel\s*>\s*\.run-detail-gear-status\s*\{[\s\S]*margin-left:\s*0;[\s\S]*width:\s*100%;/.test(splitRunsStyleSource)
    && /\.shoe-run-dropdown\.run-detail-dropdown\s*\{[\s\S]*position:\s*static;[\s\S]*left:\s*auto;[\s\S]*top:\s*auto;/.test(splitRunsStyleSource)
    && /body\.theme-light\s+\.run-detail-gear-actions\s+\.run-detail-link-btn,[\s\S]*body\.theme-high-contrast-light\s+\.run-detail-gear-actions\s+\.run-detail-link-btn\s*\{[\s\S]*background:\s*var\(--runner-profile-ink,\s*#17130f\);/.test(splitLightThemeStyleSource),
  'Run Detail gear linking action should render as a full-width anchored pill under the shoe text, not as a floating red text label.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-panel\s*\{[\s\S]*padding:\s*clamp\(18px,\s*1\.7vw,\s*24px\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-row\s*\{[\s\S]*grid-template-columns:\s*56px\s+minmax\(0,\s*1fr\);[\s\S]*gap:\s*12px;[\s\S]*max-width:\s*280px;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-art\s*\{[\s\S]*width:\s*56px;[\s\S]*height:\s*56px;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-actions\s*\{[\s\S]*max-width:\s*280px;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-actions\s+\.run-detail-link-btn\s*\{[\s\S]*min-height:\s*34px;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-panel\s*\{[\s\S]*padding:\s*clamp\(18px,\s*1\.7vw,\s*24px\);/.test(splitRunsStyleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-row\s*\{[\s\S]*grid-template-columns:\s*56px\s+minmax\(0,\s*1fr\);[\s\S]*gap:\s*12px;[\s\S]*max-width:\s*280px;/.test(splitRunsStyleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-art\s*\{[\s\S]*width:\s*56px;[\s\S]*height:\s*56px;/.test(splitRunsStyleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-actions\s*\{[\s\S]*max-width:\s*280px;/.test(splitRunsStyleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-gear-actions\s+\.run-detail-link-btn\s*\{[\s\S]*min-height:\s*34px;/.test(splitRunsStyleSource),
  'Run Detail gear panel should keep the shoe grid compact under the gear panel.',
);

assert(
  runDetailSource.includes('const displaySample = getTelemetryDisplaySample(samples);')
    && runDetailSource.includes('const telemetryTabDefinitions = useMemo(() => telemetryDefinitions')
    && runDetailSource.includes('hasData: Boolean(displaySample)')
    && runDetailSource.includes('if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;')
    && runDetailSource.includes('telemetryTabDefinitions.map((definition) =>')
    && runDetailSource.includes("icon: 'monitor_heart'")
    && runDetailSource.includes("icon: 'telemetry_cadence'")
    && runDetailSource.includes("icon: 'telemetry_stride'")
    && runDetailSource.includes("icon: 'telemetry_ground_contact'")
    && runDetailSource.includes("icon: 'telemetry_vertical'")
    && runDetailSource.includes("icon: 'telemetry_elevation'")
    && appIconSource.includes("case 'telemetry_cadence':")
    && appIconSource.includes("case 'telemetry_stride':")
    && appIconSource.includes("case 'telemetry_ground_contact':")
    && appIconSource.includes("case 'telemetry_vertical':")
    && appIconSource.includes("case 'telemetry_elevation':")
    && runDetailSource.includes('definition.icon && !isActive')
    && runDetailSource.includes('className="run-detail-telemetry-tab-icon"')
    && runDetailSource.includes('formatTelemetryValue(displaySample.value, definition.key)')
    && runDetailSource.includes('<em>{definition.unit}</em>')
    && !runDetailSource.includes("t('run_detail.telemetry_subtitle')")
    && !runDetailSource.includes('training_' + 'effect_estimated')
    && !runDetailSource.includes('trainingEffect?.basis')
    && !runDetailSource.includes('samples.length ? samples.length.toLocaleString()')
    && !runDetailSource.includes('run-detail-telemetry-resolution')
    && !runDetailSource.includes("t('run_detail.decoupling')")
    && !styleSource.includes('run-detail-telemetry-resolution'),
  'Run Detail telemetry tabs should show values/units without sample counts, the resolution badge, or the old explanatory subtitle.',
);

assert(
  runDetailSource.indexOf('run-detail-telemetry-section') > runDetailSource.indexOf('</aside>')
    && runDetailSource.indexOf('run-detail-telemetry-section') < runDetailSource.indexOf('run-detail-bottom-grid'),
  'Run Detail telemetry section should render at shell level before the bottom grid so the telemetry cockpit can span the full page width.',
);

assert(
  runDetailSource.indexOf('run-detail-comparison-section') > runDetailSource.indexOf('</aside>')
    && runDetailSource.indexOf('run-detail-comparison-section') < runDetailSource.indexOf('run-detail-telemetry-section')
    && runDetailSource.indexOf('run-detail-splits-section') > runDetailSource.indexOf('run-detail-telemetry-section')
    && runDetailSource.indexOf('run-detail-splits-section') < runDetailSource.indexOf('run-detail-bottom-grid')
    && !runDetailSource.includes('run-detail-comparison-arrow')
    && !runDetailSource.includes("runComparison.direction === 'slower' ? '-'")
    && !runDetailSource.includes("runComparison.direction === 'faster' ? '+'"),
  'Run Detail comparison and splits sections should render at shell level around telemetry, and the comparison panel should no longer render arrow badges for faster or slower states.',
);

assert(
  !runDetailSource.includes("t('run_detail.route_intelligence')")
    && !runDetailSource.includes("t('run_detail.analysis_notes')")
    && !runDetailSource.includes('lap.averageHeartRate || 0')
    && !runDetailSource.includes('run-detail-efficiency-panel')
    && !runDetailSource.includes('run-detail-data-quality-panel')
    && !styleSource.includes('run-detail-efficiency-panel')
    && !styleSource.includes('run-detail-data-quality-panel'),
  'Run Detail should remove the old route intelligence/analysis notes, lap-average HR source, efficiency panel, and data-quality panel.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s*\{[\s\S]*--runner-profile-paper:[\s\S]*linear-gradient\(145deg,\s*var\(--runner-profile-paper\)/.test(styleSource),
  'Run Detail should provide an unwrapped profile-aligned page fallback because App.jsx does not render the route data wrapper.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s*\{[\s\S]*--runner-profile-paper:\s*#f7efe3;[\s\S]*--runner-profile-card:\s*rgba\(255,\s*252,\s*246,\s*0\.82\);[\s\S]*--runner-profile-card-strong:\s*rgba\(255,\s*253,\s*248,\s*0\.94\);[\s\S]*--runner-profile-flame:\s*#ef6a52;[\s\S]*--runner-profile-moss:\s*#6f9474;/.test(styleSource)
    && /body:is\(\.theme-midnight,\s*\.theme-high-contrast\)\s+\.run-detail-page\.run-detail-profile-cockpit\s*\{[\s\S]*--runner-profile-paper:\s*#12100e;[\s\S]*--runner-profile-card:\s*rgba\(30,\s*27,\s*23,\s*0\.82\);[\s\S]*linear-gradient\(145deg,\s*var\(--runner-profile-paper\)\s*0%,\s*#1c1814\s*100%\)/.test(styleSource),
  'Run Detail should use the same calibrated warm paper, coral, moss, card, and dark-mode token family as Runs.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-profile-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.1fr\)\s+minmax\(340px,\s*0\.5fr\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-profile-map\s*\{[\s\S]*min-height:\s*clamp\(480px,\s*43vw,\s*720px\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-profile-stat-rail\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/.test(styleSource),
  'Run Detail cockpit CSS should define the wide map, compact evidence rail, and desktop hero composition.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-topbar\s*\{[\s\S]*gap:\s*clamp\(14px,\s*1\.8vw,\s*26px\);[\s\S]*padding:\s*clamp\(16px,\s*2vw,\s*28px\)\s*!important;[\s\S]*border-radius:\s*clamp\(22px,\s*2\.2vw,\s*34px\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-heading h1\s*\{[\s\S]*font-family:\s*"Outfit",\s*"Manrope",\s*var\(--font-display\);[\s\S]*font-size:\s*clamp\(2\.45rem,\s*5\.2vw,\s*5\.4rem\)\s*!important;[\s\S]*line-height:\s*0\.98;[\s\S]*letter-spacing:\s*-0\.035em;/.test(styleSource)
    && /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-topbar\s*\{[\s\S]*padding:\s*clamp\(16px,\s*4\.5vw,\s*22px\)\s*!important;[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-heading h1\s*\{[\s\S]*font-size:\s*clamp\(2\.2rem,\s*9\.5vw,\s*3\.4rem\)\s*!important;/.test(styleSource),
  'Run Detail topbar should use the compact profile-cockpit sizing instead of the oversized editorial shell.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-stat-card\.is-accent\s*\{[\s\S]*background:\s*var\(--runner-profile-ink\)\s*!important;[\s\S]*color:\s*#fff8ee\s*!important;/.test(styleSource)
    && !/\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-stat-card\.is-accent\s*\{[\s\S]*radial-gradient\(circle at 82% 18%/.test(styleSource),
  'Run Detail accent stat card should render as a fully dark grid card without the coral radial wash.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-debrief-panel\s*\{[\s\S]*grid-template-columns:\s*minmax\(180px,\s*0\.34fr\)\s+minmax\(0,\s*1fr\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-debrief-panel\s*\{[\s\S]*background:\s*var\(--runner-profile-ink\)\s*!important;[\s\S]*color:\s*#fff8ee\s*!important;/.test(styleSource)
    && !/\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-debrief-panel\s*\{[\s\S]*radial-gradient\(circle at 86% 8%/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-main-grid:has\(\.run-detail-debrief-section\)\s+\.run-detail-gear-panel\s*\{[\s\S]*margin-top:\s*calc\(\(clamp\(1\.25rem,\s*1\.55vw,\s*1\.65rem\)\s*\*\s*1\.1\)\s*\+\s*14px\);/.test(styleSource)
    && /@media\s*\(max-width:\s*1180px\)\s*\{[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-main-grid:has\(\.run-detail-debrief-section\)\s+\.run-detail-gear-panel\s*\{[\s\S]*margin-top:\s*0;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-comparison-section,[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-splits-section\s*\{[\s\S]*margin-top:\s*clamp\(18px,\s*2\.4vw,\s*34px\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-splits-table tbody tr:nth-child\(2n\)\s*\{[\s\S]*rgba\(247,\s*240,\s*231,\s*0\.58\)/.test(styleSource),
  'Run Detail should keep elite-runner evidence sections readable, align debrief and gear panels, and render debrief as a full-dark panel.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-telemetry-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-telemetry-tab-label\s*\{[\s\S]*display:\s*inline-flex\s*!important;[\s\S]*gap:\s*0\.45rem;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-telemetry-tab\.is-active\s+\.run-detail-telemetry-tab-icon\s*\{[\s\S]*color:\s*var\(--runner-profile-flame\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-telemetry-tab strong em\s*\{[\s\S]*font-size:\s*0\.68em;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-telemetry-panel\s*\{[\s\S]*padding:\s*clamp\(22px,\s*2\.6vw,\s*42px\)\s*!important;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-telemetry-chart\s*\{[\s\S]*min-height:\s*clamp\(340px,\s*28vw,\s*520px\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-unavailable-grid/.test(styleSource),
  'Run Detail telemetry cockpit CSS should cover chart tabs, large chart stage, and unavailable device metrics.',
);

assert(
  /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-topbar,[\s\S]*width:\s*min\(calc\(100% - 24px\),\s*100%\)\s*!important;[\s\S]*\.run-detail-profile-stat-rail\s*\{[\s\S]*grid-template-columns:\s*1fr;/.test(styleSource),
  'Run Detail cockpit CSS should include a narrow-screen layout for daily mobile use.',
);

console.log('[PASS] Run Detail profile cockpit guardrails passed.');
