// Single source of truth for route-level lazy chunk loaders.
//
// App.jsx wires every `React.lazy()` route component through these maps so the
// exact same import functions power both render-time loading and hover/focus
// prefetching. Keep every `import('../pages/...')` a static string literal:
// template-built paths would defeat Vite's static analysis and break
// route-level code splitting.

const legalPageLoader = () => import('../pages/LegalPage.jsx');

// Static app paths -> chunk loader. Param-only routes live in
// routeParamPreloaders below so keys here stay real navigable paths.
export const routePreloaders = {
  '/': () => import('../pages/Landing.jsx'),
  '/login': () => import('../pages/Login.jsx'),
  '/signup': () => import('../pages/Signup.jsx'),
  '/forgot-password': () => import('../pages/ForgotPassword.jsx'),
  '/terms': legalPageLoader,
  '/privacy': legalPageLoader,
  '/dashboard': () => import('../pages/Dashboard.jsx'),
  '/profile': () => import('../pages/Profile.jsx'),
  '/runs': () => import('../pages/Runs.jsx'),
  '/analysis': () => import('../pages/Analysis.jsx'),
  '/heatmap': () => import('../pages/Heatmap.jsx'),
  '/weather': () => import('../pages/WeatherEngine.jsx'),
  '/today-run': () => import('../pages/TodayRun.jsx'),
  '/rewards': () => import('../pages/Rewards.jsx'),
  '/settings': () => import('../pages/Settings.jsx'),
  '/settings/import-data': () => import('../pages/ImportDataSettings.jsx'),
  '/shoes': () => import('../pages/Shoes.jsx'),
  '/shoes/add': () => import('../pages/AddShoes.jsx'),
  '/shoe-catalog': () => import('../pages/ShoeCatalog.jsx'),
  '/races': () => import('../pages/Races.jsx'),
  '/schedule': () => import('../pages/Schedule.jsx'),
  '/muscle-training': () => import('../pages/MuscleTraining.jsx'),
};

// Param routes keyed by their App.jsx route pattern.
export const routeParamPreloaders = {
  '/runs/:id': () => import('../pages/RunDetail.jsx'),
  '/analysis/:insightKey': () => import('../pages/AnalysisInsightDetail.jsx'),
  '/prediction/:distKey': () => import('../pages/PredictionDetail.jsx'),
  '/races/details/:raceId': () => import('../pages/RacesDetail.jsx'),
};

function normalizeHref(href) {
  if (typeof href !== 'string') return null;
  let path = href;
  const hashIndex = path.indexOf('#');
  if (hashIndex !== -1) path = path.slice(0, hashIndex);
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) path = path.slice(0, queryIndex);
  if (path === '') return null;
  // Same-origin app paths only: reject protocol-relative (`//host`), absolute
  // (`https://...`), and scheme (`mailto:`/`tel:`) hrefs.
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

function hasPreloader(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
}

function resolveBaseRouteKey(path) {
  const segments = path.slice(1).split('/');
  // Longest static prefix wins so nested routes beat their parent.
  for (let depth = segments.length; depth >= 1; depth -= 1) {
    const candidate = `/${segments.slice(0, depth).join('/')}`;
    if (hasPreloader(routePreloaders, candidate)) return candidate;
  }
  return null;
}

/**
 * Normalizes an href to the key of the lazy chunk that renders it, or null
 * when the href is not a preloadable same-origin app route. Deep links prefer
 * their param pattern (`/runs/123` -> `/runs/:id`); other paths resolve to
 * their longest static base. Pure helper.
 */
export function resolvePreloadablePath(href) {
  const path = normalizeHref(href);
  if (!path) return null;
  return resolvePreloadKey(path);
}

function paramPatternPrefix(pattern) {
  return pattern.slice(0, pattern.lastIndexOf('/'));
}

function resolveParamPreloadKey(path) {
  let bestKey = null;
  let bestPrefixLength = -1;
  for (const pattern of Object.keys(routeParamPreloaders)) {
    const prefix = paramPatternPrefix(pattern);
    // Require a non-empty segment after the prefix so a trailing-slash base
    // path ('/runs/') is not mistaken for a param route ('/runs/123').
    const hasParamSegment = path.length > prefix.length + 1 && path.startsWith(`${prefix}/`);
    if (hasParamSegment && prefix.length > bestPrefixLength) {
      bestKey = pattern;
      bestPrefixLength = prefix.length;
    }
  }
  return bestKey;
}

// Single resolution rule shared by resolvePreloadablePath and preloadRoute:
// param patterns win over static bases so a deep link like /runs/123 resolves
// to its detail-page chunk key, not the list page's.
function resolvePreloadKey(path) {
  const paramKey = resolveParamPreloadKey(path);
  if (paramKey) return paramKey;
  return resolveBaseRouteKey(path);
}

const startedPreloads = new Set();

function startPreload(key, loader) {
  if (typeof loader !== 'function' || startedPreloads.has(key)) return;
  startedPreloads.add(key);
  try {
    // Prefetch is best-effort: load failures surface normally if the user
    // actually navigates, so swallow them here.
    loader().catch(() => {});
  } catch {
    // Synchronous import construction failures are equally non-fatal.
  }
}

/**
 * Prefetches the lazy route chunk for an app path (query/hash ignored).
 * Unknown paths and load failures are silently ignored; each chunk starts at
 * most once.
 */
export function preloadRoute(href) {
  const path = normalizeHref(href);
  if (!path) return;
  const key = resolvePreloadKey(path);
  if (!key) return;
  startPreload(key, routeParamPreloaders[key] || routePreloaders[key]);
}

let uninstallListener = null;

/**
 * Attaches one delegated capture-phase `pointerover` + `focusin` listener on
 * `document` that prefetches the route chunk behind any same-app anchor the
 * user hovers or focuses. Returns a cleanup function; installing twice returns
 * the same cleanup.
 */
export function installRoutePreloadListener() {
  if (uninstallListener) return uninstallListener;
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    return () => {};
  }

  const handlePreloadIntent = (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    preloadRoute(href);
  };

  document.addEventListener('pointerover', handlePreloadIntent, true);
  document.addEventListener('focusin', handlePreloadIntent, true);

  uninstallListener = () => {
    document.removeEventListener('pointerover', handlePreloadIntent, true);
    document.removeEventListener('focusin', handlePreloadIntent, true);
    uninstallListener = null;
  };
  return uninstallListener;
}
