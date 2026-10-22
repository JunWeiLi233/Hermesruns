import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { cleanIsolatedActors, fetchForFixture, loadIsolatedActors, actorRoles } from '../e2e/intervals-icu/fixture-lifecycle.mjs';
import { assertDisposableStack, assertSafeBaseUrl, assertPrivateFixtureDirectory,
  isolatedBackendEnvironment, readDisposableStack, safeStackName, installSyntheticMapTiles, setBrowserActor,
  freshSyntheticClientAddress, waitForVisualStability, repositoryRoot, assertIsolatedBuildDirectory } from '../e2e/fixtures/safety.mjs';

assert.equal(new Set(Array.from({ length: 1000 }, freshSyntheticClientAddress)).size, 1000);
let elapsed = 0, frames = 0;
const finite = { playState: 'running', playbackRate: 1, effect: { getComputedTiming: () => ({ endTime: 100 }) } };
const paused = { ...finite, playState: 'paused', get finished() { throw Error('Do not await paused animation promises.'); } };
const infinite = { ...finite, effect: { getComputedTiming: () => ({ endTime: Infinity }) } };
const visualPage = {
  bringToFront: async () => {},
  waitForFunction: async (_, __, options) => assert.equal(options.timeout, 5000),
  evaluate: callback => vm.runInNewContext(`(${callback.toString()})()`, {
    performance: { now: () => elapsed },
    document: { getAnimations: () => frames < 3 || frames === 5 ? [finite] : [paused, infinite] },
    setTimeout: resolve => { frames++; elapsed += 32; resolve(); },
  }),
};
await waitForVisualStability(visualPage);
assert.ok(frames >= 12, 'Wait for the later transition and a continuous quiet period.');
await assert.rejects(waitForVisualStability({ ...visualPage, evaluate: callback => vm.runInNewContext(`(${callback.toString()})()`, {
  performance: { now: () => elapsed }, document: { getAnimations: () => [finite] },
  setTimeout: resolve => { elapsed += 32; resolve(); },
}) }), /did not settle within five seconds/);

const storage = new Map();
const localStorage = { setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const passiveNavigations = [];
const actorPage = { goto: async url => passiveNavigations.push(url),
  evaluate: async (callback, actor) => vm.runInNewContext(`(${callback.toString()})(actor)`, { localStorage, actor }),
  addInitScript: () => { throw new Error('Actor setup must not reauthenticate future navigations.'); } };
for (const actor of [{ token: 'same-30', email: 'runner30@example.test' }, { token: 'same-19', email: 'runner19@example.test' },
  { token: 'same-30', email: 'runner30@example.test' }]) {
  await setBrowserActor(actorPage, actor, 'http://127.0.0.1:4331');
  assert.equal(storage.get('hermes_jwt'), actor.token);
  assert.equal(storage.get('hermes_email'), actor.email);
}
localStorage.removeItem('hermes_jwt'); localStorage.removeItem('hermes_email');
await actorPage.goto('http://127.0.0.1:4331/login');
assert.equal(storage.get('hermes_jwt'), undefined, 'Logout must survive later navigation without an explicit login helper call.');
assert.equal(passiveNavigations.filter(url => url.endsWith('/api/auth/providers')).length, 3);

let tilePredicate, tileHandler, tileResponse;
await installSyntheticMapTiles({ route: async (predicate, handler) => { tilePredicate = predicate; tileHandler = handler; } });
assert.ok(tilePredicate(new URL('http://127.0.0.1:18080/api/maps/tiles/10/900/400.png')));
assert.ok(tilePredicate(new URL('https://a.tile.openstreetmap.org/10/900/400.png')));
assert.ok(!tilePredicate(new URL('http://127.0.0.1:18080/api/races/course-map')));
await tileHandler({ request: () => ({ url: () => 'http://127.0.0.1:18080/api/maps/tiles/1/1/1.png' }),
  fulfill: async response => { tileResponse = response; } });
assert.equal(tileResponse.contentType, 'image/png');
assert.equal(tileResponse.body.subarray(1, 4).toString(), 'PNG');

for (const url of ['https://hermesruns.com', 'http://example.test:18080', 'http://127.0.0.1:8080',
  'http://localhost:8080', 'http://[::1]:8080', 'http://127.0.0.1', 'https://127.0.0.1:18080',
  'http://127.0.0.1.evil.example:18080', 'http://user:password@127.0.0.1:18080',
  'http://127.0.0.1:18080/api', 'http://127.0.0.1:18080/?url=production', 'http://127.0.0.1:18080/#fragment']) {
  assert.throws(() => assertSafeBaseUrl(url), /loopback/);
}
assert.equal(assertSafeBaseUrl('http://127.0.0.1:18080/'), 'http://127.0.0.1:18080');
assert.equal(assertSafeBaseUrl('http://localhost:18081'), 'http://localhost:18081');
assert.equal(assertSafeBaseUrl('http://[::1]:18082'), 'http://[::1]:18082');
assert.throws(() => safeStackName('../main'), /simple stack name/);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hermesruns-e2e-safety-'));
try {
  // Exercise the actual classpath resolver without importing the stack's CLI or starting a server.
  const stackSource = fs.readFileSync(path.join(repositoryRoot, 'e2e/tools/stack.mjs'), 'utf8');
  const classpathSource = stackSource.slice(stackSource.indexOf('function backendClasspath()'), stackSource.indexOf('\nasync function serve()'));
  assert.ok(classpathSource.startsWith('function backendClasspath()'));
  const mavenRoot = path.join(temporary, 'checkout & %E2E_PATH_EXPANSION%');
  const mavenBackend = path.join(mavenRoot, 'backend');
  const mavenClasses = path.join(mavenBackend, 'target-e2e', 'classes');
  const classpathFile = path.join(mavenRoot, 'cache & %E2E_PATH_EXPANSION%', 'dependencies.txt');
  const captureFile = path.join(temporary, 'maven-launch.json');
  fs.mkdirSync(mavenClasses, { recursive: true });
  fs.mkdirSync(path.join(mavenBackend, 'src/main/resources/static'), { recursive: true });
  fs.writeFileSync(path.join(mavenClasses, 'application.properties'), '');
  fs.writeFileSync(path.join(mavenBackend, 'src/main/resources/static/index.html'), '<div>fixture</div>');
  fs.writeFileSync(path.join(mavenBackend, 'probe.mjs'), `
    import fs from 'node:fs';
    fs.writeFileSync(process.env.E2E_CLASSPATH_PROBE_CAPTURE, JSON.stringify({ javaOptions: process.env.JAVA_TOOL_OPTIONS, cwd: process.cwd() }));
    fs.writeFileSync(process.env.E2E_CLASSPATH_FILE, ['dependency-one', 'spring-boot-devtools.jar', 'dependency-two'].join(process.platform === 'win32' ? ';' : ':'));
  `);
  fs.writeFileSync(path.join(mavenBackend, 'mvnw.cmd'), `@echo off\r\n"${process.execPath}" probe.mjs\r\nexit /b %errorlevel%\r\n`);
  const mavenEnv = { ...process.env, E2E_CLASSPATH_FILE: classpathFile, E2E_PATH_EXPANSION: 'must-not-expand',
    E2E_CLASSPATH_PROBE_CAPTURE: captureFile, JAVA_TOOL_OPTIONS: '-Dunrelated.parent.option=true' };
  for (const windows of [true, false]) {
    fs.rmSync(classpathFile, { force: true });
    let launches = 0;
    const result = vm.runInNewContext(`${classpathSource}\nbackendClasspath()`, {
      fs, path, repoRoot: mavenRoot, backendDir: mavenBackend, cacheDir: path.join(mavenRoot, 'cache'),
      isWin: windows, process: { env: mavenEnv }, assertIsolatedBuildDirectory: value => assertIsolatedBuildDirectory(value, mavenRoot),
      spawnSync: (command, args, options) => {
        launches++;
        if (windows) {
          assert.deepEqual(Array.from(args), ['/d', '/s', '/c', 'mvnw.cmd -f pom.xml -q dependency:build-classpath'],
            'Only a fixed literal command may reach cmd; path values must never be shell arguments.');
          assert.equal(command, 'cmd.exe');
          assert.equal(options.cwd, mavenBackend);
          assert.equal(options.env.JAVA_TOOL_OPTIONS, [
            `"-Dmaven.repo.local=${path.join(mavenRoot, '.m2repo')}"`,
            `"-Dhermes.build.directory=${path.join(mavenBackend, 'target-e2e')}"`,
            `"-Dmdep.outputFile=${classpathFile}"`,
          ].join(' '));
          if (process.platform === 'win32') {
            const child = spawnSync(command, Array.from(args), { ...options, stdio: 'pipe', encoding: 'utf8', windowsHide: true });
            assert.ifError(child.error);
            assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
            const capture = JSON.parse(fs.readFileSync(captureFile, 'utf8'));
            assert.equal(capture.javaOptions, options.env.JAVA_TOOL_OPTIONS, 'cmd must preserve literal ampersands and percent signs in Java property values.');
            assert.equal(capture.cwd.toLowerCase(), mavenBackend.toLowerCase());
            return child;
          }
        } else {
          assert.equal(command, path.join(mavenBackend, 'mvnw'));
          assert.equal(args.at(-1), `-Dmdep.outputFile=${classpathFile}`);
        }
        fs.writeFileSync(classpathFile, ['dependency-one', 'spring-boot-devtools.jar', 'dependency-two'].join(path.delimiter));
        return { status: 0 };
      },
    });
    assert.equal(launches, 1);
    assert.equal(result, [mavenClasses, 'dependency-one', 'dependency-two'].join(path.delimiter));
  }
  for (const invalid of ['invalid"path', 'invalid\npath', 'invalid\0path']) {
    assert.throws(() => vm.runInNewContext(`${classpathSource}\nbackendClasspath()`, {
      fs: { ...fs, existsSync: file => file.endsWith('application.properties') || file.endsWith('index.html'), mkdirSync: () => {}, statSync: () => ({ mtimeMs: 1 }) },
      path, repoRoot: mavenRoot, backendDir: mavenBackend, cacheDir: path.join(mavenRoot, 'cache'), isWin: true,
      process: { env: { E2E_CLASSPATH_FILE: invalid } }, assertIsolatedBuildDirectory: value => value,
      spawnSync: () => { throw Error('Unsafe paths must be rejected before a child is launched.'); },
    }), /quotes or control characters/);
  }
  const root = path.join(temporary, 'checkout');
  const auth = path.join(root, 'e2e', '.auth');
  fs.mkdirSync(auth, { recursive: true });
  assert.equal(assertIsolatedBuildDirectory(path.join(root, 'backend', 'target-e2e', 'classes'), root), path.join(fs.realpathSync(root), 'backend', 'target-e2e', 'classes'));
  assert.throws(() => assertIsolatedBuildDirectory(path.join(root, 'backend', 'target', 'classes'), root), /unique build/);
  assert.throws(() => assertIsolatedBuildDirectory(path.join(temporary, 'serving-checkout', 'classes'), root), /inside this worktree/);
  const state = { isolation: 'ephemeral-h2', instanceId: 'a'.repeat(32), repoRoot: root,
    baseUrl: 'http://127.0.0.1:18083', port: 18083, dataDir: temporary, pid: process.pid, backendPid: process.pid,
    dbUrl: `jdbc:h2:file:${fs.realpathSync(temporary).replace(/\\/g, '/')}/hermes;DB_CLOSE_ON_EXIT=FALSE` };
  assert.equal(assertDisposableStack(state, { root }), state);
  for (const changed of [{ isolation: 'production' }, { repoRoot: path.dirname(root) },
    { dbUrl: 'jdbc:postgresql://localhost/main' }, { dataDir: root }, { port: 8080 }, { instanceId: '' }]) {
    assert.throws(() => assertDisposableStack({ ...state, ...changed }, { root }));
  }
  fs.writeFileSync(path.join(auth, 'stack-secondary.json'), JSON.stringify(state));
  assert.equal(readDisposableStack({ baseUrl: state.baseUrl, root }).instanceId, state.instanceId);
  assert.throws(() => readDisposableStack({ baseUrl: 'http://127.0.0.1:18084', root }), /No matching/);
  assert.throws(() => assertPrivateFixtureDirectory(path.join(root, '.private-backups-other', 'actors'), root), /inside this worktree/);
  assert.throws(() => assertPrivateFixtureDirectory(path.join(root, '.private-backups', '..', 'actors'), root), /inside this worktree/);
  assert.equal(assertPrivateFixtureDirectory(path.join(root, '.private-backups', 'actors'), root), path.join(fs.realpathSync(root), '.private-backups', 'actors'));

  const env = isolatedBackendEnvironment({ PATH: 'tool-path', SPRING_PROFILES_ACTIVE: 'production',
    SPRING_APPLICATION_JSON: '{"spring.datasource.url":"production"}', JAVA_TOOL_OPTIONS: '-Dproduction=true',
    APP_DB_URL: 'jdbc:postgresql://production/main', APP_DB_PASSWORD: 'inherited', STRIPE_SECRET_KEY: 'inherited',
    RESEND_API_KEY: 'inherited', APP_BOOTSTRAP_ADMIN_PASSWORD: 'inherited', APP_TRUSTED_PROXIES: 'none',
    APP_API_RATE_LIMIT_AUTH_READ_USER_PER_MINUTE: '1', APP_API_RATE_LIMIT_CHECKOUT_IP_PER_MINUTE: '99999' },
  { port: state.port, dataDir: temporary, dbUrl: state.dbUrl, runnerPassword: 'synthetic-only' });
  assert.equal(env.PATH, 'tool-path');
  assert.equal(env.SPRING_PROFILES_ACTIVE, 'e2e');
  assert.equal(env.APP_DB_URL, state.dbUrl);
  assert.equal(env.APP_DB_PASSWORD, '');
  assert.equal(env.APP_TRUSTED_PROXIES, 'none');
  assert.equal(env.HERMES_OFFICIAL_COURSE_STARTUP_SEED_ENABLED, 'false');
  assert.equal(env.APP_API_RATE_LIMIT_ACTIVITY_READ_USER_PER_MINUTE, '10000');
  assert.equal(env.APP_API_RATE_LIMIT_AUTH_READ_USER_PER_MINUTE, '10000');
  assert.equal(env.APP_API_RATE_LIMIT_GLOBAL_USER_PER_MINUTE, '10000');
  assert.equal(env.APP_API_RATE_LIMIT_CHECKOUT_USER_PER_MINUTE, undefined);
  assert.equal(env.APP_API_RATE_LIMIT_CHECKOUT_IP_PER_MINUTE, undefined);
  assert.equal(env.APP_API_RATE_LIMIT_GLOBAL_IP_PER_MINUTE, undefined);
  assert.equal(env.APP_API_RATE_LIMIT_AUTH_WRITE_USER_PER_MINUTE, undefined);
  assert.equal(env.APP_TRAININGWORKSPACE_PRIVATEDIRECTORY, path.join(temporary, 'training-private'));
  assert.equal(env.APP_TRAININGWORKSPACE_JOBSENABLED, 'false');
  const importEnv = isolatedBackendEnvironment({ STRAVA_CLIENT_SECRET: 'inherited' },
    { port: state.port, dataDir: temporary, dbUrl: state.dbUrl, runnerPassword: 'synthetic-only', trainingImportJobs: true });
  assert.equal(importEnv.APP_TRAININGWORKSPACE_JOBSENABLED, 'true');
  assert.equal(importEnv.STRAVA_SYNC_ENABLED, 'false');
  assert.equal(importEnv.STRAVA_CLIENT_SECRET, undefined);
  assert.equal(importEnv.APP_TRAININGWORKSPACE_PRIVATEDIRECTORY, path.join(temporary, 'training-private'));
  for (const key of ['JAVA_TOOL_OPTIONS', 'SPRING_APPLICATION_JSON', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'APP_BOOTSTRAP_ADMIN_PASSWORD']) {
    assert.equal(env[key], undefined, `${key} must not survive into the test JVM`);
  }
  const fixtureRun = assertPrivateFixtureDirectory(path.join(repositoryRoot, '.private-backups', `fixture-safety-${process.pid}-${Date.now()}`));
  fs.mkdirSync(fixtureRun, { recursive: true });
  try {
    const fixtureState = { ...state, repoRoot: repositoryRoot };
    const tag = 'c'.repeat(32);
    const saved = { isolation: 'ephemeral-h2', instanceId: fixtureState.instanceId, baseURL: fixtureState.baseUrl, tag,
      actors: Object.fromEntries(actorRoles.map(role => [role, { email: `qa-training-${tag}-${role}@example.test`, token: role }])) };
    const save = fixture => fs.writeFileSync(path.join(fixtureRun, 'actors.json'), JSON.stringify(fixture));
    let requests = [];
    const deleted = new Set();
    const fakeFetch = async (url, options) => {
      const role = options.headers.Authorization.slice('Bearer '.length);
      requests.push({ method: options.method || 'GET', url });
      assert.equal(options.redirect, 'error');
      if (options.method === 'DELETE') { deleted.add(role); return { status: 200, json: async () => ({ deleted: true }) }; }
      return { status: deleted.has(role) ? 401 : 200, json: async () => ({ email: saved.actors[role].email }) };
    };
    for (const baseURL of ['http://localhost:8080', 'https://hermesruns.com']) {
      save({ ...saved, baseURL });
      await assert.rejects(cleanIsolatedActors(fixtureRun, { readStack: () => fixtureState, fetchImpl: fakeFetch }), /loopback/);
      assert.equal(requests.length, 0);
    }
    save(saved);
    await assert.rejects(cleanIsolatedActors(fixtureRun, { readStack: () => ({ ...fixtureState, instanceId: 'd'.repeat(32) }), fetchImpl: fakeFetch }), /different disposable/);
    assert.equal(requests.length, 0, 'Stale instance metadata must fail before any external request.');
    save({ ...saved, actors: { ...saved.actors, member: { ...saved.actors.member, email: 'ordinary@example.test' } } });
    await assert.rejects(cleanIsolatedActors(fixtureRun, { readStack: () => fixtureState, fetchImpl: fakeFetch }), /identity mismatch/);
    assert.equal(requests.length, 0, 'All reserved actor identities must be checked before any external request.');
    save(saved);
    const context = loadIsolatedActors(fixtureRun, () => fixtureState);
    assert.throws(() => fetchForFixture(context, 'https://example.com/api/me', {}, fakeFetch), /recorded disposable API/);
    assert.equal(requests.length, 0);
    assert.equal((await cleanIsolatedActors(fixtureRun, { readStack: () => fixtureState, fetchImpl: fakeFetch })).syntheticAccountsDeleted, 5);
    assert.deepEqual(requests.slice(0, 5).map(request => request.method), Array(5).fill('GET'));
    assert.deepEqual(requests.slice(5).map(request => request.method), Array(5).fill('DELETE'));
    assert.equal((await cleanIsolatedActors(fixtureRun, { phase: 'verify', readStack: () => fixtureState, fetchImpl: fakeFetch })).allActorSessionsRevoked, true);
    save({ ...saved, baseURL: 'http://localhost:8080' });
    for (const script of ['cleanup.mjs', 'plan-activation.verify.mjs']) {
      const smoke = spawnSync(process.execPath, [path.join(repositoryRoot, 'e2e/intervals-icu', script)], {
        encoding: 'utf8', env: { ...process.env, HERMES_TRAINING_QA_RUN: fixtureRun },
      });
      assert.notEqual(smoke.status, 0);
      assert.match(smoke.stderr, /loopback/);
    }
    if (process.platform === 'win32') {
      const smoke = spawnSync('pwsh', ['-NoProfile', '-File', path.join(repositoryRoot, 'e2e/intervals-icu/provision.ps1'), '-Phase', 'Seed', '-RunDirectory', fixtureRun], {
        encoding: 'utf8', env: { ...process.env, E2E_BASE_URL: 'http://localhost:8080' },
      });
      assert.ifError(smoke.error);
      assert.notEqual(smoke.status, 0);
      assert.match(smoke.stderr, /loopback/);
    }
  } finally {
    assertPrivateFixtureDirectory(fixtureRun);
    fs.rmSync(fixtureRun, { recursive: true, force: true });
  }
  console.log('PASS E2E URLs, named stack identity, H2 containment, private actors and environment isolation');
} finally {
  const resolved = fs.realpathSync(temporary);
  assert.ok(path.relative(fs.realpathSync(os.tmpdir()), resolved).startsWith('hermesruns-e2e-safety-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}
