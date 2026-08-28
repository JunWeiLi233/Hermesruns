import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const repoRoot = path.resolve(frontendRoot, '..', '..');
const landingSource = readFileSync(path.join(here, 'Landing.jsx'), 'utf8');
const appSource = readFileSync(path.join(frontendRoot, 'App.jsx'), 'utf8');
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const indexCss = readFileSync(path.join(frontendRoot, 'index.css'), 'utf8');
const activeIndexCss = indexCss.replace(/\/\* HERMES_LEGACY_STYLE_MANIFEST_START[\s\S]*?HERMES_LEGACY_STYLE_MANIFEST_END \*\//, '');
const indexHtml = readFileSync(path.join(frontendRoot, '..', 'index.html'), 'utf8');
const appCss = readFileSync(path.join(frontendRoot, 'styles/app.css'), 'utf8');
const securityHeadersSource = readFileSync(
  path.join(repoRoot, 'backend/src/main/java/com/hermes/backend/SecurityHeadersFilter.java'),
  'utf8',
);

assert.match(
  landingSource,
  /import worldMapPoliticalDotted from '..\/assets\/generated\/landing-world-map-political-dotted\.webp';/,
  'Landing should serve the optimized WebP map asset.',
);

assert.ok(
  existsSync(path.join(frontendRoot, 'assets/generated/landing-world-map-political-dotted.webp')),
  'The optimized landing map asset should exist.',
);

assert.ok(
  statSync(path.join(frontendRoot, 'assets/generated/run-gait-v2/evo-sl-side-master.webp')).size < 300000,
  'The landing hero shoe bitmap should stay below 300 KiB after optimization.',
);

assert.equal(
  [...landingSource.matchAll(/<img className="landing-strava-connect-button"[^>]*>/g)].length,
  2,
  'Both Strava CTAs should keep their official image artwork.',
);
assert.doesNotMatch(
  landingSource,
  /<img className="landing-strava-connect-button"(?![^>]*\bwidth="237"[^>]*\bheight="48")/,
  'Strava CTA images should declare their intrinsic dimensions.',
);

assert.match(
  landingSource,
  /<h2>\{card\.title\}<\/h2>/,
  'The feature deck should not skip from the hero h1 directly to h3 headings.',
);
assert.doesNotMatch(
  landingSource,
  /<h3>\{card\.title\}<\/h3>/,
  'Feature deck card titles should use the next valid heading level.',
);

assert.doesNotMatch(activeIndexCss, /_split\/(?:landing|profile|analysis|runs|races|schedule|shoes|muscle-training|heatmap|weather|rewards|settings)\.css/);
assert.doesNotMatch(
  indexHtml,
  /fonts\.googleapis\.com\/css2[^\n]*Material\+Symbols/,
  'The icon font should not block the landing document before the app bootstraps.',
);
assert.doesNotMatch(
  indexHtml,
  /preconnect[^>]*fonts\.(googleapis|gstatic)\.com/,
  'The document should not preconnect to Google Fonts on every page when only the admin dashboard uses the icon font.',
);
assert.doesNotMatch(
  appCss,
  /fonts\.googleapis\.com[^\n]*Material\+Symbols/,
  'The application stylesheet must not chain a cross-origin Google Fonts import; it gates every authenticated route behind RouteStyleGate.',
);
assert.match(
  dashboardSource,
  /id = 'admin-material-symbols-font'/,
  'The admin dashboard chunk should load the Material Symbols icon font on demand for its data-icon spans.',
);
assert.match(
  appSource,
  /function RouteStyleGate\([\s\S]*?import\('\.\/styles\/app\.css'\)/,
  'Non-landing routes should load the application stylesheet on demand.',
);

assert.match(
  securityHeadersSource,
  /Cross-Origin-Opener-Policy/,
  'The origin should send a COOP header.',
);
assert.match(
  securityHeadersSource,
  /https:\/\/static\.cloudflareinsights\.com[\s\S]*https:\/\/cloudflareinsights\.com/,
  'CSP should allow the configured Cloudflare Insights script and beacon without console violations.',
);

console.log('[PASS] Landing Lighthouse regression guardrails passed.');
