import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const launcherPath = path.resolve(here, '../.codex/runtime/omx-launcher.mjs');

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omx-launcher-test-'));
const distDir = path.join(workDir, 'dist');
const stateDir = path.join(workDir, 'state');
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(stateDir, { recursive: true });

const fakeServerPath = path.join(distDir, 'fake-server.mjs');
fs.writeFileSync(fakeServerPath, 'setInterval(() => {}, 1 << 30);\n');

const scriptTag = crypto.createHash('sha1').update(fakeServerPath).digest('hex').slice(0, 16);
const launcherEnv = {
  ...process.env,
  OMX_DIST_DIR: distDir,
  OMX_LAUNCHER_STATE_DIR: stateDir,
};

const sleepers = [];
const launchers = [];

function startSleeper() {
  const sleeper = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1 << 30)'], {
    stdio: 'ignore',
  });
  sleepers.push(sleeper);
  return sleeper;
}

function startLauncher() {
  const launcher = spawn(process.execPath, [launcherPath, 'fake-server.mjs'], {
    env: launcherEnv,
    stdio: 'ignore',
  });
  launchers.push(launcher);
  return launcher;
}

function pidAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function waitFor(condition, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (condition()) return resolve();
      if (Date.now() > deadline) return reject(new Error(`timeout waiting for: ${label}`));
      setTimeout(tick, 100);
    };
    tick();
  });
}

function statePathFor(pid) {
  return path.join(stateDir, `${scriptTag}-${pid}.json`);
}

function writeFakeState({ launcherPid, hostPid, childPid, startedAt }) {
  fs.writeFileSync(
    statePathFor(launcherPid),
    JSON.stringify({
      v: 1,
      script: fakeServerPath,
      pid: launcherPid,
      childPid,
      ppid: hostPid,
      startedAt,
      heartbeat: Date.now(),
    }),
  );
}

async function testSameHostTakeover() {
  const first = startLauncher();
  await waitFor(() => fs.existsSync(statePathFor(first.pid)), 5000, 'first launcher state file');
  const firstState = JSON.parse(fs.readFileSync(statePathFor(first.pid), 'utf8'));
  assert.ok(pidAlive(firstState.childPid), 'first set child should be running');

  const second = startLauncher();
  await waitFor(() => fs.existsSync(statePathFor(second.pid)), 5000, 'second launcher state file');
  await waitFor(() => !pidAlive(first.pid), 4000, 'first launcher reaped by same-host takeover');
  await waitFor(() => !fs.existsSync(statePathFor(first.pid)), 4000, 'first launcher state file removed (grace timer)');
}

async function testDeadLauncherChildIsKilled() {
  const deadLauncher = startSleeper();
  const orphanChild = startSleeper();
  writeFakeState({
    launcherPid: deadLauncher.pid,
    hostPid: process.pid,
    childPid: orphanChild.pid,
    startedAt: Date.now(),
  });
  deadLauncher.kill('SIGKILL');
  await waitFor(() => !pidAlive(deadLauncher.pid), 3000, 'fake dead launcher exits');

  const replacement = startLauncher();
  await waitFor(() => fs.existsSync(statePathFor(replacement.pid)), 5000, 'replacement state file');
  await waitFor(() => !pidAlive(orphanChild.pid), 4000, 'orphaned child killed with its dead launcher record');
  await waitFor(() => !fs.existsSync(statePathFor(deadLauncher.pid)), 4000, 'dead launcher state file removed (grace timer)');
}

async function testCrossHostSetsAreCappedOldestFirst() {
  const fakeHost = startSleeper();
  const sets = [0, 1, 2].map((index) => {
    const launcher = startSleeper();
    const child = startSleeper();
    writeFakeState({
      launcherPid: launcher.pid,
      hostPid: fakeHost.pid,
      childPid: child.pid,
      startedAt: Date.now() - (3 - index) * 60_000,
    });
    return { launcher, child };
  });

  const newcomer = startLauncher();
  await waitFor(() => fs.existsSync(statePathFor(newcomer.pid)), 5000, 'newcomer state file');

  // Default cap is 2 sets per script: newcomer + the newest fake set survive,
  // the two oldest fake sets are evicted.
  await waitFor(() => !pidAlive(sets[0].launcher.pid), 4000, 'oldest fake set evicted');
  await waitFor(() => !pidAlive(sets[1].launcher.pid), 4000, 'second-oldest fake set evicted');
  assert.ok(pidAlive(sets[2].launcher.pid), 'newest fake set from a live host must be kept');
  assert.ok(pidAlive(sets[2].child.pid), 'kept fake set child must stay alive');
}

async function main() {
  try {
    await testSameHostTakeover();
    await testDeadLauncherChildIsKilled();
    await testCrossHostSetsAreCappedOldestFirst();
    console.log('[PASS] omx-launcher takeover guards passed.');
  } finally {
    for (const launcher of launchers) {
      try { launcher.kill('SIGKILL'); } catch { /* already gone */ }
    }
    for (const sleeper of sleepers) {
      try { sleeper.kill('SIGKILL'); } catch { /* already gone */ }
    }
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
