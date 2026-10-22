#!/usr/bin/env node
// Throwaway HermesRuns stack for the e2e suite.
//
//   node tools/stack.mjs serve    run in the foreground (what Playwright's webServer starts)
//   node tools/stack.mjs start    start detached and wait until it answers
//   node tools/stack.mjs stop     stop it and delete its database
//   node tools/stack.mjs status   print where it is
//
// A second stack can run beside the first for a test that needs the app configured differently (one that trusts no proxy, say):
// give it a name, a port and its settings in the environment, for example
//   E2E_STACK_NAME=strict E2E_PORT=18082 APP_TRUSTED_PROXIES=none node tools/stack.mjs start
// A named stack keeps its state in .auth/stack-<name>.json, so it and the first one do not overwrite each other.
//
// One Spring Boot process on a private port (default 18080) with a fresh H2 database in the OS temp folder, the built
// frontend served from an explicit build or backend/target-e2e/classes/static, provider syncs off and the local shared runner on. Nothing here
// touches port 8080, your dev database or your Strava / Garmin links.
// E2E_BACKEND_JAR verifies a packaged release; E2E_FAILURE_LOG keeps a failed startup log.
// E2E_TRAINING_IMPORT_JOBS=true opts into the private local-file importer for intervals tests; provider syncs stay off.
//
// Build first into a unique Maven directory and set E2E_BACKEND_JAR or E2E_BACKEND_CLASSES_DIR.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { assertReleaseStackIdentity, releaseIdentity } from './stack-identity.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertDisposableStack, assertSafeBaseUrl, assertIsolatedBuildDirectory, isolatedBackendEnvironment, safeStackName } from '../fixtures/safety.mjs';

const e2eDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(e2eDir, '..');
const backendDir = path.join(repoRoot, 'backend');
const authDir = path.join(e2eDir, '.auth');
const cacheDir = path.join(e2eDir, '.cache');
const stackName = safeStackName(process.env.E2E_STACK_NAME || '');
const stateFile = path.join(authDir, stackName ? `stack-${stackName}.json` : 'stack.json');
const isWin = process.platform === 'win32';
const port = Number(process.env.E2E_PORT || 18080);
const baseUrl = assertSafeBaseUrl(`http://127.0.0.1:${port}`);
const healthPath = '/api/auth/providers';
const trainingImportJobs = process.env.E2E_TRAINING_IMPORT_JOBS === 'true';

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
  const classes = assertIsolatedBuildDirectory(process.env.E2E_BACKEND_CLASSES_DIR
    ? path.resolve(process.env.E2E_BACKEND_CLASSES_DIR) : path.join(backendDir, 'target-e2e', 'classes'));
  if (!fs.existsSync(path.join(classes, 'application.properties'))) {
    throw new Error('backend is not compiled: set E2E_BACKEND_JAR or E2E_BACKEND_CLASSES_DIR to an isolated build.');
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

  const cpFile = path.resolve(process.env.E2E_CLASSPATH_FILE || path.join(cacheDir, 'classpath.txt'));
  if (!fs.existsSync(cpFile)) {
    const properties = [
      `-Dmaven.repo.local=${path.join(repoRoot, '.m2repo')}`,
      `-Dhermes.build.directory=${path.join(backendDir, 'target-e2e')}`,
      `-Dmdep.outputFile=${cpFile}`,
    ];
    if (isWin && properties.some(value => /["\u0000-\u001f]/.test(value))) {
      throw new Error('Maven classpath paths cannot contain quotes or control characters.');
    }
    fs.mkdirSync(path.dirname(cpFile), { recursive: true });
    const mvn = path.join(backendDir, isWin ? 'mvnw.cmd' : 'mvnw');
    // Windows batch wrappers require cmd. Keep its command entirely literal: Java reads these
    // quoted properties itself, so spaces, ampersands and %variables% in paths cannot become commands.
    const res = isWin
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'mvnw.cmd -f pom.xml -q dependency:build-classpath'], {
        cwd: backendDir, windowsHide: true, stdio: 'inherit',
        env: { ...process.env, JAVA_TOOL_OPTIONS: properties.map(value => `"${value}"`).join(' ') },
      })
      : spawnSync(mvn, ['-f', path.join(backendDir, 'pom.xml'), '-q', 'dependency:build-classpath', ...properties], { stdio: 'inherit' });
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
  if (process.env.E2E_DB_URL) throw new Error('The disposable E2E stack only supports its own temporary H2 database.');
  if (await healthy()) {
    console.error(`something already answers on ${baseUrl}; stop it first (or set E2E_PORT)`);
    process.exit(1);
  }
  const releaseJar = process.env.E2E_BACKEND_JAR ? path.resolve(process.env.E2E_BACKEND_JAR) : null;
  if (releaseJar && !fs.existsSync(releaseJar)) throw new Error(`Release jar does not exist: ${releaseJar}`);
  const backendArguments = releaseJar ? ['-jar', releaseJar] : ['-cp', backendClasspath(), 'com.hermes.backend.BackendApplication'];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermesruns-e2e-'));
  const runnerEmail = 'strava+140971747@hermes.local'; // the local shared runner's fixed address
  const runnerPassword = strongPassword();
  const admin = process.env.E2E_SYNTHETIC_ADMIN === 'true' ? {
    email: `e2e-admin-${crypto.randomBytes(8).toString('hex')}@example.test`,
    password: strongPassword(), bootstrapToken: crypto.randomBytes(32).toString('hex'),
  } : undefined;
  const instanceId = crypto.randomBytes(16).toString('hex');
  const dbUrl = `jdbc:h2:file:${fs.realpathSync(dataDir).replace(/\\/g, '/')}/hermes;DB_CLOSE_ON_EXIT=FALSE`;
  const log = fs.openSync(path.join(dataDir, 'backend.log'), 'a');
  const env = isolatedBackendEnvironment(process.env, { port, dataDir, dbUrl, runnerPassword, admin, trainingImportJobs });
  const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', isWin ? 'java.exe' : 'java') : 'java';
  const child = spawn(
    java,
    ['-XX:TieredStopAtLevel=1', '-Xmx768m', ...backendArguments],
    { env, cwd: dataDir, stdio: ['ignore', log, log], windowsHide: true },
  );
  const state = { isolation: 'ephemeral-h2', instanceId, repoRoot, dbUrl, baseUrl, port, pid: process.pid,
    backendPid: child.pid, dataDir, runnerEmail, runnerPassword, trainingImportJobs, ...(admin ? { admin } : {}), ...releaseIdentity(releaseJar) };
  assertDisposableStack(state);

  const cleanup = () => {
    killTree(child.pid);
    try {
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {
      /* the folder is in the OS temp dir, leaving it is harmless */
    }
    try {
      if (readState()?.instanceId === instanceId) fs.rmSync(stateFile, { force: true });
    } catch {
      /* ignore */
    }
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(signal, () => process.exit(0));
  process.on('exit', cleanup);

  // Written before the wait, not after: Playwright starts the suite the moment the health URL answers, and its global setup reads
  // this file at once. Written after, the file could be a few milliseconds late and the whole run would fail to start.
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(
    stateFile,
    JSON.stringify(state, null, 2),
    { mode: 0o600 },
  );
  try {
    await waitHealthy(Number(process.env.E2E_BOOT_TIMEOUT_MS || 240_000), child);
  } catch (error) {
    if (process.env.E2E_FAILURE_LOG) fs.copyFileSync(path.join(dataDir, 'backend.log'), path.resolve(process.env.E2E_FAILURE_LOG));
    console.error(String(error));
    console.error(`backend log: ${path.join(dataDir, 'backend.log')}`);
    process.exit(1);
  }
  console.log(`READY ${baseUrl} (backend pid ${child.pid}, data ${dataDir})`);
  child.on('exit', (code) => {
    console.error(`backend exited with code ${code}`);
    process.exit(code ?? 1);
  });
  await new Promise(() => {}); // stay in the foreground until we are killed
}

async function start() {
  if (await healthy()) {
    assertDisposableStack(readState());
    assertReleaseStackIdentity(readState(), process.env.E2E_BACKEND_JAR, baseUrl);
    if (Boolean(readState().trainingImportJobs) !== trainingImportJobs) {
      throw new Error('Disposable stack local-file worker setting changed; stop and start this named stack first.');
    }
    console.log(`already running at ${baseUrl}`);
    return;
  }
  fs.mkdirSync(authDir, { recursive: true });
  const out = fs.openSync(path.join(authDir, stackName ? `serve-${stackName}.log` : 'serve.log'), 'w');
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
  assertDisposableStack(state);
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
