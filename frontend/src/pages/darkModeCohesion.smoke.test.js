import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const cohesionPath = path.join(srcRoot, 'styles', 'dark-mode-cohesion.css');

function read(relativePath) {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const indexSource = read('index.css');
const profileSource = read('pages/ProfileDashboard.jsx');
const dashboardSource = read('pages/Dashboard.jsx');
const appIconSource = read('components/AppIcon.jsx');
const cohesionSource = existsSync(cohesionPath) ? readFileSync(cohesionPath, 'utf8') : '';

assert(
  indexSource.includes("@import './styles/dark-mode-cohesion.css';")
    && indexSource.indexOf("@import './styles/dark-mode-cohesion.css';")
      > indexSource.indexOf("@import './styles/run-detail-profile-minimal.css';"),
  'Dark-mode cohesion must load after every route redesign layer.',
);

assert(
  /body\.theme-midnight\s+:is\([\s\S]*\.analysis-page-shell,[\s\S]*\.runs-dashboard-page,[\s\S]*\.weather-engine-page,[\s\S]*\.shoes-dashboard-page,[\s\S]*\.races-dashboard-page,[\s\S]*\.schedule-plan-page[\s\S]*\)\s*\{[\s\S]*--runner-minimal-canvas:\s*#171512;[\s\S]*--runner-minimal-surface:\s*#211e19;[\s\S]*--runner-minimal-ink:\s*#fff8ee;/.test(cohesionSource),
  'Runner routes must remap the light-only minimalist tokens to the Profile dark palette.',
);

for (const selector of [
  '.runs-dashboard-page',
  '.analysis-page-shell',
  '.weather-engine-page',
  '.shoes-dashboard-page',
  '.races-dashboard-page',
  '.garmin-import-page-shell',
]) {
  assert(
    cohesionSource.includes(selector),
    `Dark-mode cohesion is missing the ${selector} route treatment.`,
  );
}

assert(
  cohesionSource.includes('.recent-runs-month-header')
    && cohesionSource.includes('.recent-runs-card-metric')
    && cohesionSource.includes('.runs-profile-secondary-action')
    && cohesionSource.includes('.analysis-overview-hero-value')
    && cohesionSource.includes('.analysis-page-shell.analysis-page-shell .runner-shell-canvas.runner-shell-canvas::before')
    && cohesionSource.includes('.weather-engine-hud-card')
    && cohesionSource.includes('.shoe-rotation-signal-highlight')
    && cohesionSource.includes('.race-center-country-chip')
    && cohesionSource.includes('.race-center-pb-card')
    && cohesionSource.includes('.run-detail-splits-table tbody tr')
    && cohesionSource.includes('.dashboard-body .top-nav'),
  'Known light-surface leaks must have explicit dark-theme coverage.',
);

assert(
  cohesionSource.includes('.landing-page--liquid-glass')
    && cohesionSource.includes('.landing-cinematic-hero--minimal')
    && cohesionSource.includes('.landing-cinematic-answer-card')
    && cohesionSource.includes('.landing-cinematic-footer'),
  'The public landing page must have a complete midnight treatment.',
);

assert(
  cohesionSource.includes('.auth-page--liquid-glass .form-group--auth input')
    && cohesionSource.includes('.auth-page--liquid-glass .auth-flow-header h3')
    && cohesionSource.includes('.legal-page.auth-page--liquid-glass')
    && cohesionSource.includes('.legal-page-content'),
  'Authentication and legal pages must not retain their light-only liquid-glass palette.',
);

assert(
  cohesionSource.includes('.analysis-insight-detail-page .runner-shell-canvas.analysis-insight-detail-canvas')
    && cohesionSource.includes('.analysis-insight-detail-page.is-load-balance')
    && cohesionSource.includes('.analysis-load-command-chart-card')
    && cohesionSource.includes('.analysis-insight-detail-page.is-injury-risk .analysis-cinematic-card')
    && cohesionSource.includes('.analysis-insight-detail-page.is-coach-insight .analysis-coach-command-hero-metric')
    && cohesionSource.includes('.analysis-insight-detail-page.is-intensity .analysis-intensity-command-sample-visual span')
    && cohesionSource.includes('.runner-shell-icon-btn'),
  'Analysis detail pages and their shared controls must use the midnight surface system.',
);

assert(
  cohesionSource.includes('.race-detail-page')
    && cohesionSource.includes('.race-detail-map-stage')
    && cohesionSource.includes('.race-detail-map-leaflet .leaflet-tile-pane')
    && cohesionSource.includes('.race-detail-map-leaflet .leaflet-control-zoom a')
    && cohesionSource.includes('.race-detail-map-leaflet .leaflet-control-attribution'),
  'Race detail maps must not remain a light island in midnight mode.',
);

assert(
  cohesionSource.includes('.page-skeleton--runner')
    && cohesionSource.includes('.page-skeleton--heatmap-page')
    && cohesionSource.includes('.page-skeleton__heatmap-map-shell')
    && cohesionSource.includes('.today-run-command-page .today-run-coaching-answer')
    && cohesionSource.includes('.landing-cinematic-final-card--minimal .landing-cinematic-final-trust span')
    && cohesionSource.includes('.run-detail-profile-minimal .run-detail-icon-btn')
    && cohesionSource.includes('.run-detail-map-background .leaflet-control-attribution'),
  'Midnight loading, landing trust cells, and run-detail utility controls must not flash light surfaces.',
);

assert(
  profileSource.includes('<AppIcon name="speed"')
    && profileSource.includes('<AppIcon name="show_chart"')
    && profileSource.includes('<AppIcon name="flag"')
    && !profileSource.includes('<span className="material-symbols-outlined">speed</span>')
    && !profileSource.includes('<span className="material-symbols-outlined">show_chart</span>')
    && !profileSource.includes('<span className="material-symbols-outlined">flag</span>'),
  'Profile metric icons must render as local SVGs when the remote symbol font is unavailable.',
);

assert(
  cohesionSource.includes('.dashboard-body.admin-command-page')
    && cohesionSource.includes('--admin-profile-paper: #171512')
    && cohesionSource.includes('.admin-users-command-hero')
    && cohesionSource.includes('.admin-track-hub-hero')
    && cohesionSource.includes('.admin-shoe-stitch-hero')
    && cohesionSource.includes('.admin-jobs-command-deck__hero')
    && cohesionSource.includes('.admin-audit-terminal__hero')
    && cohesionSource.includes('.admin-settings-studio__hero')
    && cohesionSource.includes('.admin-review-preview__map .leaflet-pane[class*="admin-review-preview__tile-pane"]')
    && cohesionSource.includes('.admin-jobs-command-deck__spotlight')
    && cohesionSource.includes('.admin-shoe-stitch-query-shell')
    && cohesionSource.includes('.admin-command-route--courseMaps')
    && cohesionSource.includes('.admin-command-sidebar__nav.ops-sidebar-nav'),
  'Every admin route, map preview, and mobile navigation rail must use the Profile midnight palette.',
);

assert(
  dashboardSource.includes("import AppIcon from '../components/AppIcon';")
    && !dashboardSource.includes('<span className="material-symbols-outlined"')
    && appIconSource.includes("case 'terminal':")
    && appIconSource.includes("case 'download':")
    && appIconSource.includes("case 'analytics':"),
  'Admin controls must use local SVG icons instead of an unavailable remote symbol font.',
);

assert(
  cohesionSource.includes(':focus-visible')
    && cohesionSource.includes('@media (prefers-reduced-motion: reduce)')
    && cohesionSource.includes('@media (max-width: 760px)'),
  'The dark-mode repair must preserve visible focus, reduced motion, and mobile behavior.',
);

console.log('darkModeCohesion.smoke.test.js passed');
