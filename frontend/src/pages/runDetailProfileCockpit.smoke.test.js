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
  /\.run-detail-page\.run-detail-profile-cockpit\s*\{[\s\S]*--runner-profile-paper:[\s\S]*linear-gradient\(145deg,\s*var\(--runner-profile-paper\)/.test(styleSource),
  'Run Detail should provide an unwrapped profile-aligned page fallback because App.jsx does not render the route data wrapper.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-profile-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.1fr\)\s+minmax\(340px,\s*0\.5fr\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-profile-map\s*\{[\s\S]*min-height:\s*clamp\(480px,\s*43vw,\s*720px\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-profile-stat-rail\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/.test(styleSource),
  'Run Detail cockpit CSS should define the wide map, compact evidence rail, and desktop hero composition.',
);

assert(
  /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-debrief-panel\s*\{[\s\S]*grid-template-columns:\s*minmax\(180px,\s*0\.34fr\)\s+minmax\(0,\s*1fr\);/.test(styleSource)
    && /\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-splits-table tbody tr:nth-child\(2n\)\s*\{[\s\S]*rgba\(247,\s*240,\s*231,\s*0\.58\)/.test(styleSource),
  'Run Detail should keep elite-runner evidence sections readable instead of only restyling the hero.',
);

assert(
  /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.run-detail-page\.run-detail-profile-cockpit\s+\.run-detail-topbar,[\s\S]*width:\s*min\(calc\(100% - 24px\),\s*100%\)\s*!important;[\s\S]*\.run-detail-profile-stat-rail\s*\{[\s\S]*grid-template-columns:\s*1fr;/.test(styleSource),
  'Run Detail cockpit CSS should include a narrow-screen layout for daily mobile use.',
);

console.log('[PASS] Run Detail profile cockpit guardrails passed.');
