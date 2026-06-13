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
const styleSource = read('styles/style.css');

assert(
  (runDetailSource.match(/run-detail-page run-detail-profile-cockpit/g) || []).length >= 3,
  'Run Detail loading, empty, and loaded states should all opt into the profile cockpit shell.',
);

assert(
  runDetailSource.includes('run-detail-hero-grid run-detail-profile-hero')
    && runDetailSource.includes('run-detail-map-card run-detail-profile-map')
    && runDetailSource.includes('run-detail-stat-rail run-detail-profile-stat-rail'),
  'Run Detail should render the profile hero, map, and stat-rail hooks targeted by the profile CSS.',
);

assert(
  runDetailSource.includes('<Link to="/runs"')
    && runDetailSource.includes("aria-label={t('run_detail.back_to_runs')}")
    && runDetailSource.includes("t('run_detail.no_run_selected')"),
  'Run Detail redesign must preserve back navigation and the recoverable empty state.',
);

assert(
  runDetailSource.includes('/telemetry')
    && runDetailSource.includes("activeTelemetryKey")
    && runDetailSource.includes("run-detail-telemetry-section")
    && runDetailSource.includes("groundContactTimeMs")
    && runDetailSource.includes("verticalOscillationCm"),
  'Run Detail should fetch and render the telemetry stream instead of relying on lap-average charts.',
);

assert(
  runDetailSource.includes('const displaySample = getTelemetryDisplaySample(samples);')
    && runDetailSource.includes('formatTelemetryValue(displaySample.value, definition.key)')
    && runDetailSource.includes('<em>{definition.unit}</em>')
    && !runDetailSource.includes('samples.length ? samples.length.toLocaleString()'),
  'Run Detail telemetry tabs should show the metric value and corresponding unit instead of sample counts.',
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
    && runDetailSource.indexOf('run-detail-splits-section') < runDetailSource.indexOf('run-detail-bottom-grid'),
  'Run Detail comparison and splits sections should render at shell level around telemetry instead of being constrained to the primary column.',
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
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-debrief-panel\s*\{[\s\S]*grid-template-columns:\s*minmax\(180px,\s*0\.34fr\)\s+minmax\(0,\s*1fr\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-main-grid:has\(\.run-detail-debrief-section\)\s+\.run-detail-gear-panel\s*\{[\s\S]*margin-top:\s*calc\(\(clamp\(1\.25rem,\s*1\.55vw,\s*1\.65rem\)\s*\*\s*1\.1\)\s*\+\s*14px\);/.test(styleSource)
    && /@media\s*\(max-width:\s*1180px\)\s*\{[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-main-grid:has\(\.run-detail-debrief-section\)\s+\.run-detail-gear-panel\s*\{[\s\S]*margin-top:\s*0;/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-comparison-section,[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-splits-section\s*\{[\s\S]*margin-top:\s*clamp\(18px,\s*2\.4vw,\s*34px\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-splits-table tbody tr:nth-child\(2n\)\s*\{[\s\S]*rgba\(247,\s*240,\s*231,\s*0\.58\)/.test(styleSource),
  'Run Detail should keep elite-runner evidence sections readable and align debrief and gear panels in the desktop grid.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-telemetry-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\);/.test(styleSource)
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
