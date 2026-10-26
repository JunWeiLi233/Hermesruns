import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const TILE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
let nextClientAddress = crypto.getRandomValues(new Uint32Array(1))[0] & 0xffffff;

export function freshSyntheticClientAddress() {
  nextClientAddress = (nextClientAddress + 1) & 0xffffff;
  return `10.${(nextClientAddress >> 16) & 255}.${(nextClientAddress >> 8) & 255}.${nextClientAddress & 255}`;
}

/** Wait for stable rendered colors without awaiting paused or infinite animation promises. */
export async function waitForVisualStability(page) {
  await page.bringToFront();
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 5000 });
  await page.evaluate(async () => {
    const deadline = performance.now() + 5000;
    let quietSince;
    while (performance.now() < deadline) {
      const running = document.getAnimations().filter(animation => animation.playState === 'running'
        && animation.playbackRate !== 0 && Number.isFinite(animation.effect?.getComputedTiming().endTime));
      if (running.length) quietSince = undefined;
      else {
        quietSince ??= performance.now();
        if (performance.now() - quietSince >= 200) return;
      }
      await new Promise(resolve => setTimeout(resolve, 32));
    }
    throw new Error('Finite visible animations did not settle within five seconds before the accessibility scan.');
  });
}

export function isMapTileUrl(url) {
  return url.pathname.startsWith('/api/maps/tiles/') || /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname);
}

/** Keep the app's real Leaflet layers and vector paths, but never fetch third-party map tiles in browser tests. */
export async function installSyntheticMapTiles(context, onRequest = () => {}) {
  await context.route(isMapTileUrl, route => {
    onRequest(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG });
  });
}

/** Explicit actor changes happen once; future navigations must respect a real logout or expired session. */
export async function setBrowserActor(page, actor, baseUrl) {
  const origin = assertSafeBaseUrl(baseUrl);
  // A script-free same-origin document stops the prior account's React effects before storage is replaced.
  await page.goto(`${origin}/api/auth/providers`);
  await page.evaluate(auth => {
    localStorage.setItem('hermes_jwt', auth.token);
    localStorage.setItem('hermes_email', auth.email);
    localStorage.removeItem('hermes_role');
    localStorage.setItem('hermes_lang', 'en');
    localStorage.setItem('hermes_unit', 'km');
  }, actor);
}

export function safeStackName(value = '') {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('E2E_STACK_NAME must be a simple stack name.');
  return value;
}

export function assertSafeBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('E2E requires an HTTP loopback test URL.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535 || Number(url.port) === 8080
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('E2E requires a loopback test origin on an explicit non-8080 port.');
  }
  return url.origin;
}

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resolvedThroughExistingParents(candidate) {
  let existing = path.resolve(candidate);
  const missing = [];
  while (!fs.existsSync(existing)) {
    missing.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error('Cannot resolve isolated fixture path.');
    existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...missing);
}

export function assertPrivateFixtureDirectory(directory, root = repositoryRoot) {
  const privateRoot = resolvedThroughExistingParents(path.join(root, '.private-backups'));
  const resolved = resolvedThroughExistingParents(directory);
  if (!within(fs.realpathSync(root), privateRoot) || !within(privateRoot, resolved)) {
    throw new Error('Actor fixtures must be inside this worktree .private-backups directory.');
  }
  return resolved;
}

export function assertIsolatedBuildDirectory(directory, root = repositoryRoot) {
  const checkout = fs.realpathSync(root);
  const lexical = path.resolve(directory);
  if (!within(path.resolve(root), lexical)) throw Error('Compiled E2E resources must stay inside this worktree.');
  const resolved = resolvedThroughExistingParents(lexical);
  const sharedTarget = path.join(checkout, 'backend', 'target');
  if (!within(checkout, resolved) || resolved === sharedTarget || within(sharedTarget, resolved)) {
    throw Error('Compiled E2E resources require a unique build directory inside this worktree.');
  }
  return resolved;
}

export function assertDisposableStack(state, { root = repositoryRoot, tempRoot = os.tmpdir() } = {}) {
  if (!state || state.isolation !== 'ephemeral-h2' || !/^[a-f0-9]{32}$/.test(state.instanceId || '')
      || path.resolve(state.repoRoot || '') !== path.resolve(root)) {
    throw new Error('A recorded disposable H2 stack identity from this worktree is required.');
  }
  const baseUrl = assertSafeBaseUrl(state.baseUrl);
  if (Number(new URL(baseUrl).port) !== state.port) throw new Error('Disposable stack port does not match its URL.');
  const dataDir = resolvedThroughExistingParents(state.dataDir || '');
  const temporary = resolvedThroughExistingParents(tempRoot);
  if (!within(temporary, dataDir) || !path.basename(dataDir).startsWith('hermesruns-e2e-')) {
    throw new Error('Disposable stack data must be in its own Hermes OS temporary directory.');
  }
  const expectedDb = `jdbc:h2:file:${dataDir.replace(/\\/g, '/')}/hermes;DB_CLOSE_ON_EXIT=FALSE`;
  if (state.dbUrl !== expectedDb) throw new Error('Disposable stack database must be its recorded temporary H2 file.');
  if (![state.pid, state.backendPid].every(value => Number.isInteger(value) && value > 0)) {
    throw new Error('Disposable stack process identities are missing.');
  }
  return state;
}

/** Find by origin across all named stacks: secondary test stacks need not use the parent's E2E_STACK_NAME. */
export function readDisposableStack({ baseUrl, name = process.env.E2E_STACK_NAME || '', root = repositoryRoot } = {}) {
  const authDir = path.join(root, 'e2e', '.auth');
  const expected = baseUrl ? assertSafeBaseUrl(baseUrl) : null;
  const files = expected
    ? (fs.existsSync(authDir) ? fs.readdirSync(authDir).filter(file => /^stack(?:-[A-Za-z0-9_-]+)?\.json$/.test(file)) : [])
    : [safeStackName(name) ? `stack-${name}.json` : 'stack.json'];
  for (const file of files) {
    let state;
    try { state = JSON.parse(fs.readFileSync(path.join(authDir, file), 'utf8')); } catch { continue; }
    if (expected && state.baseUrl !== expected) continue;
    assertDisposableStack(state, { root });
    if (!fs.existsSync(state.dataDir)) throw new Error('Disposable stack temporary directory no longer exists.');
    try { process.kill(state.backendPid, 0); } catch { throw new Error('Recorded disposable backend is no longer running.'); }
    return state;
  }
  throw new Error('No matching disposable test stack is recorded. Start e2e/tools/stack.mjs first.');
}

export function assertActorFixture(fixture, state) {
  assertDisposableStack(state);
  if (fixture?.isolation !== 'ephemeral-h2' || fixture.instanceId !== state.instanceId
      || assertSafeBaseUrl(fixture.baseURL) !== state.baseUrl) {
    throw new Error('Actor fixtures belong to a different disposable test stack. Provision them again.');
  }
  return fixture;
}

/** Only operating-system launch settings survive. Application credentials and Spring injection settings never do. */
export function isolatedBackendEnvironment(parent, { port, dataDir, dbUrl, runnerPassword, admin, trainingImportJobs = false }) {
  const baseUrl = assertSafeBaseUrl(`http://127.0.0.1:${port}`);
  const env = {};
  const operatingSystem = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'HOME',
    'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMFILES', 'PROGRAMDATA', 'JAVA_HOME', 'NUMBER_OF_PROCESSORS',
    'PROCESSOR_ARCHITECTURE', 'LANG', 'LC_ALL', 'TZ']);
  for (const [key, value] of Object.entries(parent)) if (operatingSystem.has(key.toUpperCase()) && value !== undefined) env[key] = value;
  return {
    ...env,
    PORT: String(port), SERVER_PORT: String(port), APP_SERVER_ADDRESS: '127.0.0.1', SERVER_ADDRESS: '127.0.0.1',
    SPRING_CONFIG_LOCATION: 'classpath:/', SPRING_PROFILES_ACTIVE: 'e2e', HERMES_ENV: 'development',
    APP_DB_URL: dbUrl, SPRING_DATASOURCE_URL: dbUrl, APP_DB_DRIVER: 'org.h2.Driver',
    SPRING_DATASOURCE_DRIVERCLASSNAME: 'org.h2.Driver', APP_DB_USERNAME: 'sa', APP_DB_PASSWORD: '',
    APP_JPA_DDL_AUTO: 'create-drop', SPRING_JPA_HIBERNATE_DDL_AUTO: 'create-drop',
    STRAVA_SYNC_ENABLED: 'false', GARMIN_WELLNESS_SYNC_ENABLED: 'false', APP_COACH_NIGHTLY_ENABLED: 'false',
    HERMES_OFFICIAL_COURSE_STARTUP_SEED_ENABLED: 'false', APP_OFFICIAL_COURSE_STARTUP_SEED_ENABLED: 'false',
    APP_TRAINING_CATCHUP_ON_STARTUP: 'false', APP_RECORDS_CATCHUP_ON_STARTUP: 'false', APP_ELEVATION_CATCHUP_ON_STARTUP: 'false',
    APP_LOCAL_SHARED_RUNNER_ENABLED: 'true', APP_LOCAL_SHARED_RUNNER_PASSWORD: runnerPassword,
    APP_LOCAL_SHARED_RUNNER_SEED_MOCK_DATA: 'false', APP_PUBLIC_BASE_URL: baseUrl, APP_MAIL_PROVIDER: 'disabled',
    APP_FORCE_HTTPS: 'false', APP_ENABLE_HSTS: 'false', APP_TRUSTED_PROXIES: parent.APP_TRUSTED_PROXIES || 'private',
    // A browser suite reuses a seeded runner for hundreds of reads. Preserve IP/write/checkout budgets.
    APP_API_RATE_LIMIT_GLOBAL_USER_PER_MINUTE: '10000', APP_API_RATE_LIMIT_ACTIVITY_READ_USER_PER_MINUTE: '10000',
    APP_API_RATE_LIMIT_AUTH_READ_USER_PER_MINUTE: '10000',
    APP_COURSE_MAP_UPLOAD_DIR: path.join(dataDir, 'course-map-images'),
    HERMES_COURSE_MAP_UPLOAD_DIR: path.join(dataDir, 'course-map-images'),
    APP_TRAININGWORKSPACE_PRIVATEDIRECTORY: path.join(dataDir, 'training-private'),
    // This worker imports only the synthetic files queued in the isolated private directory.
    APP_TRAININGWORKSPACE_JOBSENABLED: trainingImportJobs === true ? 'true' : 'false', APP_TRAININGWORKSPACE_COOKIESECURE: 'false',
    ...(admin ? {
      APP_BOOTSTRAP_ADMIN_EMAIL: admin.email, APP_BOOTSTRAP_ADMIN_PASSWORD: admin.password,
      HERMES_ADMIN_MFA_ENABLED: 'true', HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN: admin.bootstrapToken,
      HERMES_WEBAUTHN_RP_ID: 'localhost',
      HERMES_WEBAUTHN_ALLOWED_ORIGINS: `${baseUrl},http://localhost:${port}`,
    } : {}),
  };
}
