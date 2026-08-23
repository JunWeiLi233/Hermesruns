import { existsSync, readFileSync } from 'node:fs';
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
const enPageCopySource = read('i18n/locales/en/pages.js');
const zhCnPageCopySource = read('i18n/locales/zh-CN/pages.js');
const styleSource = read('styles/style.generated.css');
const splitRunsStyleSource = read('styles/_split/runs.css');
const splitLightThemeStyleSource = read('styles/_split/light-theme-overrides.css');
const indexStyleSource = read('index.css');
const minimalStyleRelativePath = 'styles/run-detail-profile-minimal.css';
const minimalStyleSource = existsSync(path.join(srcRoot, minimalStyleRelativePath))
  ? read(minimalStyleRelativePath)
  : '';
const overviewStart = runDetailSource.indexOf('<section id="run-detail-overview" className="run-detail-overview-card">');
const overviewEnd = runDetailSource.indexOf('<section id="run-detail-telemetry"', overviewStart);

assert(
  runDetailSource.includes('run-detail-page run-detail-profile-cockpit run-detail-profile-minimal')
    && indexStyleSource.includes("@import './styles/run-detail-profile-minimal.css';")
    && indexStyleSource.indexOf("@import './styles/run-detail-profile-minimal.css';")
      > indexStyleSource.indexOf("@import './styles/loading-skeleton.css';"),
  'Loaded Run Detail should opt into a dedicated Profile-minimal layer imported after shared page treatments.',
);

const splitsSectionStart = runDetailSource.indexOf('<section id="run-detail-splits"');
const splitsPanelStart = runDetailSource.indexOf('<div className="run-detail-panel run-detail-table-panel">', splitsSectionStart);
const splitsHeadingStart = runDetailSource.indexOf('<div className="run-detail-section-head">', splitsSectionStart);
const splitsTableStart = runDetailSource.indexOf('<table className="run-detail-splits-table">', splitsSectionStart);
assert(
  splitsPanelStart >= 0
    && splitsHeadingStart > splitsPanelStart
    && splitsTableStart > splitsHeadingStart
    && /\.run-detail-runner-page\s+\.run-detail-profile-minimal\s+\.run-detail-splits-section\s*>\s*\.run-detail-table-panel\s*>\s*\.run-detail-section-head\s*\{[^}]*margin:\s*0;[^}]*padding:\s*20px\s+22px\s+14px;/.test(minimalStyleSource),
  'Run Detail splits should connect its 分圈 heading and action row to the table inside one shared panel.',
);

assert(
  overviewStart >= 0
    && overviewEnd > overviewStart
    && runDetailSource.includes("t('run_detail.overview_title')")
    && runDetailSource.indexOf('run-detail-overview-stat-grid', overviewStart) < overviewEnd
    && runDetailSource.indexOf('run-detail-debrief-section', overviewStart) < overviewEnd
    && runDetailSource.indexOf('run-detail-gear-section', overviewStart) < overviewEnd
    && runDetailSource.indexOf('run-detail-comparison-section', overviewStart) < overviewEnd
    && /\.run-detail-profile-minimal\s+\.run-detail-overview-card\s*\{[\s\S]*background:\s*var\(--run-detail-card\)\s*!important;/.test(minimalStyleSource)
    && /"overview_title": "Overview"/.test(enPageCopySource)
    && /"overview_title": "概览"/.test(zhCnPageCopySource),
  'Overview must be one localized card that contains coach review, linked gear, distance, pace, moving time, and recent comparison.',
);

assert(
  !/className="run-detail-overview-stat is-accent"/.test(runDetailSource.slice(overviewStart, overviewEnd)),
  'Overview distance, pace, and moving-time tiles should share the same neutral surface.',
);

assert(
  minimalStyleSource.includes('.run-detail-profile-minimal {')
    && minimalStyleSource.includes('--run-detail-card: #ffffff;')
    && minimalStyleSource.includes('--run-detail-ink: #1c1917;')
    && minimalStyleSource.includes('--run-detail-accent: var(--brand-accent, #a0392a);')
    && minimalStyleSource.includes('background: transparent !important;'),
  'Run Detail should map Profile paper, card, ink, and accent tokens onto a transparent runner-shell canvas.',
);

assert(
  /\.run-detail-profile-minimal\s+\.run-detail-topbar\s*\{[\s\S]*padding:\s*8px\s+0\s+20px\s*!important;[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*transparent\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/.test(minimalStyleSource)
    && /\.run-detail-profile-minimal\s+\.run-detail-heading h1\s*\{[\s\S]*font-size:\s*clamp\(1\.85rem,\s*3vw,\s*2\.45rem\)\s*!important;[\s\S]*line-height:\s*1\.08;/.test(minimalStyleSource)
    && runDetailSource.includes('className="run-detail-eyebrow"'),
  'Run Detail should use Profile-scale header typography rather than an oversized standalone hero card.',
);

assert(
  /\.run-detail-profile-minimal\s+\.run-detail-profile-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*2\.25fr\)\s+minmax\(220px,\s*0\.75fr\);/.test(minimalStyleSource)
    && /\.run-detail-profile-minimal\s+\.run-detail-profile-map\s*\{[\s\S]*min-height:\s*clamp\(360px,\s*38vw,\s*480px\);/.test(minimalStyleSource)
    && /\.run-detail-profile-minimal\s+\.run-detail-profile-stat-rail\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(minimalStyleSource)
    && !runDetailSource.includes('className="run-detail-map-overlay"'),
  'Run Detail should lead with one route map and one compact evidence rail without a duplicate distance overlay.',
);

assert(
  runDetailSource.includes("${points.length > 0 ? ' has-route-map-page-background' : ''}")
    && runDetailSource.includes('className="run-detail-map-background"')
    && /<main className="runner-shell-main">\s*\{points\.length > 0 && \(\s*<div className="run-detail-map-background">/.test(runDetailSource)
    && !runDetailSource.includes('mapBackground = null')
    && !runDetailSource.includes('{mapBackground}')
    && !runDetailSource.includes('{isCompactMapLayout && routeMapBackground}')
    && runDetailSource.includes('points.length === 0 && ('),
  'Loaded routes should mount one OpenStreetMap layer at the authenticated shell level while retaining the no-route fallback.',
);

assert(
  /points\.length === 0 && \(\s*<section className="run-detail-hero-grid run-detail-profile-hero">[\s\S]*?<div className="run-detail-map-card run-detail-profile-map">[\s\S]*?<\/div>\s*<\/section>\s*\)\}\s*<section id="run-detail-overview" className="run-detail-overview-card">/.test(runDetailSource),
  'Activity metrics should remain in Overview whether or not a route map is available.',
);

assert(
  /points\.length === 0 && \(\s*<div className="run-detail-topbar">/.test(runDetailSource)
    && !minimalStyleSource.includes('.run-detail-profile-minimal.has-route-map-background .run-detail-topbar {'),
  'Map-backed Run Detail should remove the activity header block entirely while no-route activities retain their controls.',
);

assert(
  /\.runner-shell-page\.run-detail-runner-page\.has-route-map-page-background\s+\.run-detail-map-background\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*z-index:\s*0;/.test(minimalStyleSource)
    && /\.runner-shell-page\.run-detail-runner-page\.has-route-map-page-background\s+\.runner-shell-canvas\s*\{[\s\S]*position:\s*relative;[\s\S]*z-index:\s*1;/.test(minimalStyleSource)
    && !/\.runner-shell-page\.run-detail-runner-page\.has-route-map-page-background\s+\.run-detail-map-background\s*\{[^}]*height:\s*clamp\(/.test(minimalStyleSource)
    && /\.run-detail-map-background\s+\.leaflet-top\s*\{[\s\S]*top:\s*12px;/.test(minimalStyleSource),
  'Route maps should remain an absolute full-page OpenStreetMap backdrop behind the content canvas.',
);

assert(
  !runDetailSource.includes('hasMapBackground')
    && !minimalStyleSource.includes('.runner-shell-main > .run-detail-map-background')
    && !minimalStyleSource.includes('.has-run-detail-map'),
  'Route maps should not use the former fixed-background shell overlay.',
);

assert(
  /@media\s*\(min-width:\s*861px\)\s*\{[\s\S]*\.run-detail-profile-minimal\.has-route-map-background\s+\.run-detail-overview-card\s*\{[\s\S]*width:\s*100%;/.test(minimalStyleSource)
    && !minimalStyleSource.includes('width: min(50%, 920px);'),
  'Overview should span the page below the top map rather than sharing the map horizontally.',
);

assert(
  /@media\s*\(max-width:\s*860px\)\s*\{[\s\S]*\.run-detail-runner-page\s+\.run-detail-page\.run-detail-profile-cockpit\.run-detail-profile-minimal\.has-route-map-background\s+\.run-detail-shell\s*\{[\s\S]*padding-top:\s*clamp\(344px,\s*calc\(82vw \+ 24px\),\s*484px\)\s*!important;/.test(minimalStyleSource)
    && runDetailSource.includes("window.matchMedia('(max-width: 860px)')")
    && runDetailSource.includes('map.invalidateSize({ pan: false })'),
  'Mobile should keep the route-map stage ahead of Overview and Leaflet should invalidate its size after shell geometry changes.',
);

assert(
  runDetailSource.includes('className="run-detail-overview-section run-detail-gear-section"')
    && /run-detail-gear-section[\s\S]*<h3>\{t\('run_detail\.gear_linked'\)\}<\/h3>[\s\S]*run-detail-panel run-detail-gear-panel/.test(runDetailSource)
    && /\.run-detail-profile-minimal\s+\.run-detail-panel,[\s\S]*\.run-detail-profile-minimal\s+\.run-detail-stat-card\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*border-radius:\s*var\(--run-detail-radius-lg\);/.test(minimalStyleSource),
  'Coach, Gear, and evidence sections should share Profile headings and borderless tonal cards.',
);

assert(
  /@media\s*\(max-width:\s*960px\)\s*\{[\s\S]*\.run-detail-profile-minimal\s+\.run-detail-profile-stat-rail\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/.test(minimalStyleSource)
    && /@media\s*\(max-width:\s*680px\)\s*\{[\s\S]*\.run-detail-profile-minimal\s+\.run-detail-profile-stat-rail,[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(minimalStyleSource)
    && /\.run-detail-profile-minimal\s+:is\(button,\s*a\):focus-visible\s*\{[\s\S]*outline:\s*2px solid var\(--run-detail-accent\);/.test(minimalStyleSource)
    && /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(minimalStyleSource),
  'Run Detail should collapse cleanly for tablet/mobile and preserve visible keyboard focus and reduced-motion behavior.',
);

assert(
  runDetailSource.includes("import { Link, useNavigate, useParams } from 'react-router';")
    && runDetailSource.includes("activeKey: 'activities'")
    && runDetailSource.includes('runner-shell-page runner-dashboard-page runs-dashboard-page run-detail-runner-page')
    && runDetailSource.includes('<RunnerShellTopNav')
    && runDetailSource.includes('parentRoute="/runs"')
    && runDetailSource.includes('<RunsSubpageNav')
    && runDetailSource.includes('className="runner-shell-canvas"'),
  'Run Detail should live inside the shared authenticated runner shell with Runs active and a Runs breadcrumb.',
);

assert(
  /\.run-detail-runner-page\s+\.run-detail-page\.run-detail-profile-cockpit\s*\{[\s\S]*min-height:\s*auto;[\s\S]*padding:\s*0;[\s\S]*background:\s*transparent\s*!important;/.test(splitRunsStyleSource)
    && /\.run-detail-runner-page\s+\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-profile-stat-rail\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(splitRunsStyleSource)
    && /\.run-detail-runner-page\s+\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-stat-card\.is-accent\s*\{[\s\S]*grid-column:\s*auto;/.test(splitRunsStyleSource)
    && /\.run-detail-runner-page\s+\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-stat-card\.is-accent\s+:is\(span,\s*strong,\s*em\)\s*\{[\s\S]*color:\s*#fff8ee\s*!important;[\s\S]*-webkit-text-fill-color:\s*#fff8ee\s*!important;/.test(splitRunsStyleSource),
  'Run Detail should inherit the Profile canvas and use a compact one-column evidence rail instead of the oversized standalone stat grid.',
);

assert(
  (runDetailSource.match(/run-detail-page run-detail-profile-cockpit/g) || []).length >= 3,
  'Run Detail loading, empty, and loaded states should all opt into the profile cockpit shell.',
);

assert(
  runDetailSource.includes('run-detail-overview-card')
    && runDetailSource.includes('run-detail-map-card run-detail-profile-map')
    && runDetailSource.includes('run-detail-overview-stat-grid')
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
  /\.run-detail-profile-minimal\s+\.run-detail-warning-action,\s*\.run-detail-profile-minimal\s+\.run-detail-splits-section\s+\.run-detail-section-head\s*>\s*\.run-detail-link-btn\s*\{[^}]*min-height:\s*42px;[^}]*padding:\s*10px\s+17px;[^}]*min-width:\s*104px;[^}]*background:\s*var\(--run-detail-dark\)\s*!important;/.test(minimalStyleSource),
  'Run Detail 查看全部 should share the rounded 重新校准 button treatment.',
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
  runDetailSource.indexOf('run-detail-telemetry-section') > overviewEnd,
  'Run Detail telemetry should follow the consolidated Overview card so the telemetry cockpit can span the full page width.',
);

const telemetryPanelStart = runDetailSource.indexOf('<div className="run-detail-panel run-detail-telemetry-panel">');
const telemetryHeadingStart = runDetailSource.indexOf('<div className="run-detail-section-head run-detail-telemetry-heading">');
const telemetryTabsStart = runDetailSource.indexOf('<div className="run-detail-telemetry-tabs"');
assert(
  telemetryPanelStart >= 0
    && telemetryHeadingStart > telemetryPanelStart
    && telemetryTabsStart > telemetryHeadingStart,
  'Run Detail telemetry should connect its 运动数据 heading to the metric grid inside one shared panel.',
);

assert(
  /\.run-detail-profile-minimal\.has-route-map-background\s+\.run-detail-telemetry-heading\s+h2\s*\{[^}]*padding:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/.test(minimalStyleSource),
  'Run Detail telemetry should keep the connected 运动数据 heading free of a background strip.',
);

assert(
  runDetailSource.indexOf('run-detail-comparison-section') > overviewStart
    && runDetailSource.indexOf('run-detail-comparison-section') < overviewEnd
    && runDetailSource.indexOf('run-detail-splits-section') > runDetailSource.indexOf('run-detail-telemetry-section')
    && !runDetailSource.includes('run-detail-comparison-arrow')
    && !runDetailSource.includes("runComparison.direction === 'slower' ? '-'")
    && !runDetailSource.includes("runComparison.direction === 'faster' ? '+'"),
  'Run Detail comparison should live in Overview, while splits remain after telemetry and comparison still avoids arrow badges.',
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
  /\.run-detail-profile-minimal\s+\.run-detail-overview-stat\.is-accent\s*\{[\s\S]*background:\s*var\(--run-detail-dark\);/.test(minimalStyleSource)
    && /\.run-detail-profile-minimal\s+\.run-detail-overview-stat\.is-accent\s+:is\(span, strong, em\)\s*\{[\s\S]*color:\s*var\(--run-detail-dark-ink\)\s*!important;/.test(minimalStyleSource)
    && !/\.run-detail-profile-minimal\s+\.run-detail-overview-stat\.is-accent\s*\{[\s\S]*radial-gradient\(circle at 82% 18%/.test(minimalStyleSource),
  'Run Detail Overview should keep its distance metric as a dark tonal cell without a coral radial wash.',
);

assert(
  /\.run-detail-runner-page\s+\.run-detail-profile-minimal\s+\.run-detail-debrief-panel\s*\{[^}]*background:\s*#000\s*!important;[^}]*color:\s*#fff\s*!important;/.test(minimalStyleSource)
    && /\.run-detail-profile-minimal\s+\.run-detail-debrief-readiness\s+strong\s*\{[\s\S]*color:\s*#fff\s*!important;[\s\S]*-webkit-text-fill-color:\s*#fff\s*!important;/.test(minimalStyleSource),
  'Run Detail coach debrief should use a pure-black panel with a pure-white readiness score.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-debrief-panel\s*\{[\s\S]*grid-template-columns:\s*minmax\(180px,\s*0\.34fr\)\s+minmax\(0,\s*1fr\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-debrief-panel\s*\{[\s\S]*background:\s*var\(--runner-profile-ink\)\s*!important;[\s\S]*color:\s*#fff8ee\s*!important;/.test(styleSource)
    && !/\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-debrief-panel\s*\{[\s\S]*radial-gradient\(circle at 86% 8%/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-main-grid:has\(\.run-detail-debrief-section\)\s+\.run-detail-gear-panel\s*\{[\s\S]*margin-top:\s*calc\(\(clamp\(1\.25rem,\s*1\.55vw,\s*1\.65rem\)\s*\*\s*1\.1\)\s*\+\s*14px\);/.test(styleSource)
    && /@media\s*\(max-width:\s*1180px\)\s*\{[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-main-grid:has\(\.run-detail-debrief-section\)\s+\.run-detail-gear-panel\s*\{[\s\S]*margin-top:\s*0;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-comparison-section,[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-splits-section\s*\{[\s\S]*margin-top:\s*clamp\(18px,\s*2\.4vw,\s*34px\);/.test(styleSource),
  'Run Detail should keep elite-runner evidence sections readable, align debrief and gear panels, and render debrief as a full-dark panel.',
);

assert(
  /body:not\(\.theme-midnight\):not\(\.theme-high-contrast\)[\s\S]*?\.run-detail-splits-table tbody tr:nth-child\(2n\) td\s*\{[\s\S]*?background:\s*var\(--run-detail-card\)\s*!important;/.test(minimalStyleSource),
  'Run Detail split rows should keep one uniform light-white card surface instead of alternating beige bands.',
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
