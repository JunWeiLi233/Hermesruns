#!/usr/bin/env node
// Throwaway HermesRuns stack for the e2e suite.
//
//   node tools/stack.mjs serve    run in the foreground (what Playwright's webServer starts)
//   node tools/stack.mjs start    start detached and wait until it answers
//   node tools/stack.mjs stop     stop it and delete its database
//   node tools/stack.mjs status   print where it is
//
// One Spring Boot process on a private port (default 18080) with a fresh H2 database in the OS temp folder, the built
// frontend served from backend/target/classes/static, background syncs off and the local shared runner on. Nothing here
// touches port 8080, your dev database or your Strava / Garmin links.
//
// Build first:   npm --prefix frontend run build   then   backend/mvnw compile
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const e2eDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(e2eDir, '..');
const backendDir = path.join(repoRoot, 'backend');
const authDir = path.join(e2eDir, '.auth');
const cacheDir = path.join(e2eDir, '.cache');
const stateFile = path.join(authDir, 'stack.json');
const isWin = process.platform === 'win32';
const port = Number(process.env.E2E_PORT || 18080);
const baseUrl = `http://127.0.0.1:${port}`;
const healthPath = '/api/auth/providers';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

async function healthy() {
  try {
    const res = await fetch(baseUrl + healthPath, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitHealthy(timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(`backend exited early with code ${child.exitCode}`);
    if (await healthy()) return;
    await sleep(500);
  }
  throw new Error(`backend did not answer ${baseUrl}${healthPath} within ${timeoutMs / 1000}s`);
}

function strongPassword() {
  // Satisfies the sign-up rules (length, upper, lower, digit, symbol) without ever being typed or printed.
  const body = crypto.randomBytes(18).toString('base64url');
  return `Aa1!${body}`;
}

function killTree(pid) {
  if (!pid) return;
  if (isWin) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
}

function backendClasspath() {
  const classes = path.join(backendDir, 'target', 'classes');
  if (!fs.existsSync(path.join(classes, 'application.properties'))) {
    throw new Error(`backend is not compiled: run ${isWin ? 'mvnw.cmd' : './mvnw'} -f backend/pom.xml compile`);
  }
  // The frontend build writes to src/main/resources/static; Maven copies it only if it ran afterwards.
  const srcStatic = path.join(backendDir, 'src', 'main', 'resources', 'static');
  const outStatic = path.join(classes, 'static');
  if (!fs.existsSync(path.join(srcStatic, 'index.html'))) {
    throw new Error('frontend is not built: run npm --prefix frontend run build');
  }
  const stale =
    !fs.existsSync(path.join(outStatic, 'index.html')) ||
    fs.statSync(path.join(outStatic, 'index.html')).mtimeMs < fs.statSync(path.join(srcStatic, 'index.html')).mtimeMs;
  if (stale) fs.cpSync(srcStatic, outStatic, { recursive: true, force: true });

  const cpFile = process.env.E2E_CLASSPATH_FILE || path.join(cacheDir, 'classpath.txt');
  if (!fs.existsSync(cpFile)) {
    fs.mkdirSync(path.dirname(cpFile), { recursive: true });
    const mvn = path.join(backendDir, isWin ? 'mvnw.cmd' : 'mvnw');
    const args = ['-f', path.join(backendDir, 'pom.xml'), '-q', 'dependency:build-classpath', `-Dmdep.outputFile=${cpFile}`];
    const res = spawnSync(isWin ? 'cmd' : mvn, isWin ? ['/c', mvn, ...args] : args, { stdio: 'inherit' });
    if (res.status !== 0) throw new Error('could not resolve the backend classpath with Maven');
  }
  // devtools would restart the app when classes change and opens a LiveReload port that your own dev server holds.
  const deps = fs
    .readFileSync(cpFile, 'utf8')
    .trim()
    .split(path.delimiter)
    .filter((entry) => entry && !/spring-boot-devtools/.test(entry));
  return [classes, ...deps].join(path.delimiter);
}

async function serve() {
  if (await healthy()) {
    console.error(`something already answers on ${baseUrl}; stop it first (or set E2E_PORT)`);
    process.exit(1);
  }
  const classpath = backendClasspath();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermesruns-e2e-'));
  const runnerEmail = 'strava+140971747@hermes.local'; // the local shared runner's fixed address
  const runnerPassword = process.env.E2E_RUNNER_PASSWORD || strongPassword();
  const dbUrl = `jdbc:h2:file:${dataDir.replace(/\\/g, '/')}/hermes;AUTO_SERVER=TRUE`;
  const log = fs.openSync(path.join(dataDir, 'backend.log'), 'a');

  const env = {
    ...process.env,
    PORT: String(port),
    APP_SERVER_ADDRESS: '127.0.0.1',
    APP_DB_URL: dbUrl,
    HERMES_ENV: 'development',
    STRAVA_SYNC_ENABLED: 'false',
    GARMIN_WELLNESS_SYNC_ENABLED: 'false',
    APP_COACH_NIGHTLY_ENABLED: 'false',
    APP_OFFICIAL_COURSE_STARTUP_SEED_ENABLED: 'false',
    APP_LOCAL_SHARED_RUNNER_ENABLED: 'true',
    APP_LOCAL_SHARED_RUNNER_PASSWORD: runnerPassword,
    APP_PUBLIC_BASE_URL: baseUrl,
    APP_MAIL_PROVIDER: 'disabled',
  };
  const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', isWin ? 'java.exe' : 'java') : 'java';
  const child = spawn(
    java,
    ['-XX:TieredStopAtLevel=1', '-Xmx768m', '-cp', classpath, 'com.hermes.backend.BackendApplication'],
    { env, stdio: ['ignore', log, log], windowsHide: true },
  );

  const cleanup = () => {
    killTree(child.pid);
    try {
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {
      /* the folder is in the OS temp dir, leaving it is harmless */
    }
    try {
      fs.rmSync(stateFile, { force: true });
    } catch {
      /* ignore */
    }
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(signal, () => process.exit(0));
  process.on('exit', cleanup);

  try {
    await waitHealthy(Number(process.env.E2E_BOOT_TIMEOUT_MS || 240_000), child);
  } catch (error) {
    console.error(String(error));
    console.error(`backend log: ${path.join(dataDir, 'backend.log')}`);
    process.exit(1);
  }
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(
    stateFile,
    JSON.stringify({ baseUrl, port, pid: process.pid, backendPid: child.pid, dataDir, runnerEmail, runnerPassword }, null, 2),
    { mode: 0o600 },
  );
  console.log(`READY ${baseUrl} (backend pid ${child.pid}, data ${dataDir})`);
  child.on('exit', (code) => {
    console.error(`backend exited with code ${code}`);
    process.exit(code ?? 1);
  });
  await new Promise(() => {}); // stay in the foreground until we are killed
}

async function start() {
  if (await healthy()) {
    console.log(`already running at ${baseUrl}`);
    return;
  }
  fs.mkdirSync(authDir, { recursive: true });
  const out = fs.openSync(path.join(authDir, 'serve.log'), 'w');
  const child = spawn(process.execPath, [import.meta.filename, 'serve'], {
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
    env: process.env,
  });
  child.unref();
  await waitHealthy(Number(process.env.E2E_BOOT_TIMEOUT_MS || 240_000), child);
  console.log(`started: ${baseUrl}`);
}

async function stop() {
  const state = readState();
  if (!state) {
    console.log('no stack recorded');
    return;
  }
  killTree(state.pid);
  killTree(state.backendPid);
  await sleep(1000);
  try {
    fs.rmSync(state.dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    /* ignore */
  }
  fs.rmSync(stateFile, { force: true });
  console.log('stopped');
}

const command = process.argv[2] || 'status';
if (command === 'serve') await serve();
else if (command === 'start') await start();
else if (command === 'stop') await stop();
else if (command === 'status') console.log((await healthy()) ? `up at ${baseUrl}` : 'down', readState() ? '(state recorded)' : '');
else {
  console.error('usage: stack.mjs serve | start | stop | status');
  process.exit(2);
}
