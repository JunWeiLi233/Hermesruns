import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../..");
const cohesionPath = path.join(srcRoot, 'styles', 'dark-mode-cohesion.css');
const finalPalettePath = path.join(srcRoot, 'styles', 'dark-mode-final-fixes.css');

function read(relativePath) {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const indexSource = read('index.css');
const profileSource = read('pages/profile/ProfileDashboard.jsx');
const dashboardSource = read('pages/admin/Dashboard.jsx');
const appIconSource = read('components/AppIcon.jsx');
const cohesionSource = existsSync(cohesionPath) ? readFileSync(cohesionPath, 'utf8') : '';
const finalPaletteSource = existsSync(finalPalettePath) ? readFileSync(finalPalettePath, 'utf8') : '';

assert(
  indexSource.lastIndexOf("@import './styles/dark-mode-final-fixes.css';")
    > indexSource.lastIndexOf("@import './styles/runner-shell-workout-button.css';"),
  'The Profile-derived midnight palette must be the final runner color authority.',
);

for (const sourcePath of ['styles/app.css', 'styles/profile-entry.css']) {
  const imports = [];
  postcss.parse(read(sourcePath)).walkAtRules('import', ({ params }) => imports.push(params.slice(1, -1)));
  const palette = './dark-mode-final-fixes.css';
  assert(imports.filter((file) => file === palette).length === 1, `${sourcePath} must load the Profile-derived palette exactly once.`);
  for (const owner of [
    './_split/runner-shell.css', './_split/light-theme-overrides.css',
    './all-pages-liquid-glass.css', './dark-mode-cohesion.css',
    './grid-cards-white.css', './runner-shell-workout-button.css', './mobile.css',
    ...(sourcePath === 'styles/app.css' ? ['./runs-ledger-v2.css', './run-detail-v2.css', './analysis-v2.css'] : []),
  ]) {
    assert(imports.includes(owner), `${sourcePath} must retain ${owner}.`);
    assert(imports.indexOf(palette) > imports.lastIndexOf(owner), `${sourcePath} must load the Profile palette after ${owner}.`);
  }
}

// New route owners intentionally follow the shared palette. Their dark token
// overrides must stay on their own page/dialog and preserve Profile ink.
const appImports = [];
postcss.parse(read('styles/app.css')).walkAtRules('import', ({ params }) => appImports.push(params.slice(1, -1)));
for (const [file, owner, token, scope] of [
  ['races-v2.css', '.race-center-content', '--rc-ink', /\.(?:race-center-|races-dashboard-page)/],
  ['shoe-delete-modal-v2.css', '.shoe-delete-modal-card', '--sdm-ink', /\.shoe-delete-modal/],
  ['muscle-training-week-v2.css', '.mt-week-v2', '--mw-ink', /\.mt-/],
  ['analysis-load-balance-v2.css', '.analysis-load-v2', '--lb-ink', /\.analysis-load-v2|\.analysis-insight-detail-page\.is-load-balance/],
  ['import-modal-v2.css', '.import-v2-card', '--im-ink', /\.import-v2/],
  ['today-run-v2.css', '.today-run-command-canvas', '--tr-ink', /\.today-run-session-page|\.tr-v2/],
  ['shoes-v2.css', '.shoe-v2-stage', '--sv-ink', /\.shoe-v2|\.shoe-inventory-/],
  ['shoe-scan-modal-v2.css', '.scan-v2-card', '--sc-ink', /\.scan-v2|\.shoe-scan-modal/],
  ['analysis-injury-v2.css', '.analysis-injury-v2', '--ir-ink', /\.analysis-injury-v2|\.analysis-insight-detail-page\.is-injury-risk/],
  ['shoe-edit-modal-v2.css', '.edit-v2-card', '--ed-ink', /\.edit-v2/],
  ['garmin-import-modal-v2.css', '.garmin-v2-card', '--gv-ink', /\.garmin-v2/],
  ['prediction-v2.css', '.prediction-v2', '--pv-ink', /\.prediction-v2/],
]) {
  assert(appImports.filter((item) => item === `./${file}`).length === 1, `Load ${file} exactly once.`);
  assert(appImports.indexOf(`./${file}`) > appImports.indexOf('./dark-mode-final-fixes.css'), `${file} must load after the shared palette it specializes.`);
  const sheet = postcss.parse(read(`styles/${file}`));
  const darkRules = [];
  sheet.walkRules((rule) => {
    if (rule.nodes.some((node) => node.type === 'decl' && /^(?:--|background|color$|border.*color|box-shadow)/.test(node.prop))) {
      assert(rule.selectors.every((selector) => scope.test(selector)), `${file} must scope palette rules to its route/dialog: ${rule.selector}`);
    }
    if (rule.selectors.every((selector) => selector.startsWith('body:is(.theme-midnight, .theme-high-contrast)') && selector.includes(owner))
      && rule.nodes.some((node) => node.prop === token)) {
      darkRules.push(rule);
    }
  });
  const darkRule = darkRules.at(-1);
  assert(darkRule?.nodes.some((node) => node.prop === token && node.value === '#f8f4ef'), `${file} must define Profile dark ink within both dark themes and its ${owner} owner.`);
  const surface = darkRule.nodes.find((node) => node.prop === token.replace(/-ink$/, '-card') || node.prop === 'background');
  assert(surface && /^var\(--profile-night-(?:card|solid|solid-raised),/.test(surface.value), `${file} must inherit its dark surface from the Profile palette.`);
  if (surface.prop === 'background') {
    assert(surface.important, `${file} must preserve dark dialog precedence over its important light surface.`);
  }
}
for (const file of appImports.slice(appImports.indexOf('./dark-mode-final-fixes.css') + 1)) {
  postcss.parse(read(`styles/${file}`)).walkDecls(/^--profile-night-/, ({ prop }) => {
    assert(false, `${file} must specialize its route tokens instead of replacing the shared ${prop} palette.`);
  });
}

assert(
  finalPaletteSource.includes('--profile-night-canvas: linear-gradient(145deg, rgba(17, 20, 26, 0.98), rgba(8, 10, 15, 0.98))')
    && finalPaletteSource.includes('--profile-night-card: rgba(255, 255, 255, 0.04)')
    && finalPaletteSource.includes('--profile-night-ink: #f8f4ef')
    && finalPaletteSource.includes('.runner-shell-page:not(.profile-dashboard-page)')
    && finalPaletteSource.includes('.profile-import-modal-card')
    && finalPaletteSource.includes('.shoe-edit-modal-card')
    && finalPaletteSource.includes('.settings-garmin-import-modal-card'),
  'Runner pages and dialogs must inherit the rendered Profile canvas, card, ink, and overlay colors.',
);

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
  dashboardSource.includes("import AppIcon from '../../components/AppIcon';")
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
