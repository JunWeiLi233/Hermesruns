import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { discoverToolTests, runToolTests, SKIP_EXIT_CODE } from './run-tool-tests.mjs';
import { runBackendTests } from './run-backend-tests.mjs';
import { roundCloseFixtureOptions } from './test-support/round-close-fixture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const quiet = { log() {}, error() {} };

function fixture(t, files = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'hermes tool runner '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'tools'));
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

test('discovers nested test files deterministically and never selects operational scripts', (t) => {
  const rootDir = fixture(t, {
    'tools/z.test.mjs': '',
    'tools/nested/a.smoke.test.mjs': '',
    'tools/auto-hermes-loop.mjs': 'throw new Error("must not execute");',
    'tools/not-a-test.js': '',
    'outside.test.mjs': '',
  });
  const expected = ['tools/nested/a.smoke.test.mjs', 'tools/z.test.mjs'].map((file) => path.join(rootDir, file));
  assert.deepEqual(discoverToolTests(rootDir), expected);
  const calls = [];
  const summary = runToolTests({ rootDir, ...quiet, run(command, args, options) {
    calls.push(args[0]);
    assert.equal(command, process.execPath);
    assert.equal(options.cwd, rootDir);
    assert.equal(options.shell, undefined);
    return { status: 0 };
  } });
  assert.deepEqual(calls, expected);
  assert.equal(summary.passed, 2);
});

test('missing tools directory and empty selections fail instead of reporting success', (t) => {
  const rootDir = fixture(t);
  assert.throws(() => runToolTests({ rootDir, ...quiet }), /No .*test\.mjs/);
  assert.throws(() => runToolTests({ rootDir, files: [], ...quiet }), /No .*test\.mjs/);
  assert.throws(() => discoverToolTests(path.join(rootDir, 'missing')), /ENOENT/);
});

test('validates missing, outside, and operational paths before spawning any tests', (t) => {
  const rootDir = fixture(t, { 'tools/valid.test.mjs': '', 'tools/automation.mjs': '', 'outside.test.mjs': '' });
  for (const invalid of ['tools/missing.test.mjs', 'tools/automation.mjs', 'outside.test.mjs']) {
    let calls = 0;
    assert.throws(() => runToolTests({
      rootDir, files: ['tools/valid.test.mjs', invalid], ...quiet,
      run() { calls += 1; return { status: 0 }; },
    }));
    assert.equal(calls, 0);
  }
});

test('counts files accurately, continues after failure, preserves output and first failure status', (t) => {
  const rootDir = fixture(t, Object.fromEntries(['a', 'b', 'c', 'd'].map((name) => [`tools/${name}.test.mjs`, ''])));
  const outcomes = [{ status: 0 }, { status: 9, stdout: 'failure context', stderr: 'assertion failed' }, { status: SKIP_EXIT_CODE }, { status: 0 }];
  const messages = [];
  const summary = runToolTests({ rootDir, run: () => outcomes.shift(), log: (line) => messages.push(line), error: (line) => messages.push(line) });
  assert.deepEqual([summary.total, summary.passed, summary.failed, summary.skipped, summary.exitCode], [4, 2, 1, 1, 9]);
  assert.equal(outcomes.length, 0);
  assert.ok(messages.includes('failure context'));
  assert.ok(messages.includes('assertion failed'));
  assert.match(messages.at(-1), /2 passed, 1 failed, 1 skipped \(4 total\)/);
});

test('spawn errors, thrown exceptions, signals, and unknown status are failures', (t) => {
  const rootDir = fixture(t, { 'tools/child.test.mjs': '' });
  for (const outcome of [{ status: null, error: new Error('ENOENT') }, { status: null, signal: 'SIGTERM' }, {}, new Error('spawn threw')]) {
    const summary = runToolTests({ rootDir, ...quiet, run() {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    } });
    assert.deepEqual([summary.failed, summary.passed, summary.skipped, summary.exitCode], [1, 0, 0, 1]);
  }
});

test('all-skipped suites fail and diagnostic skip words do not override exit status', (t) => {
  const rootDir = fixture(t, { 'tools/child.test.mjs': '' });
  const skipped = runToolTests({ rootDir, ...quiet, run: () => ({ status: SKIP_EXIT_CODE }) });
  assert.deepEqual([skipped.passed, skipped.failed, skipped.skipped, skipped.exitCode], [0, 0, 1, 1]);
  const passed = runToolTests({ rootDir, ...quiet, run: () => ({ status: 0, stdout: 'checks skipped optional network probe' }) });
  assert.deepEqual([passed.passed, passed.skipped, passed.exitCode], [1, 0, 0]);
});

test('explicit selections deduplicate identical files', (t) => {
  const rootDir = fixture(t, { 'tools/child.test.mjs': '' });
  const summary = runToolTests({ rootDir, files: ['tools/child.test.mjs', path.join(rootDir, 'tools/child.test.mjs')], ...quiet, run: () => ({ status: 0 }) });
  assert.equal(summary.total, 1);
});

test('real child exits are classified without invoking repository automations', (t) => {
  const rootDir = fixture(t, { 'tools/pass.test.mjs': '', 'tools/fail.test.mjs': 'process.exitCode = 5;', 'tools/skip.test.mjs': 'process.exitCode = 77;' });
  const summary = runToolTests({ rootDir, ...quiet });
  assert.deepEqual([summary.passed, summary.failed, summary.skipped, summary.exitCode], [1, 1, 1, 5]);
});

test('CLI propagates failure for missing explicit files', () => {
  const result = spawnSync(process.execPath, [path.join(here, 'run-tool-tests.mjs'), 'tools/nonexistent-runner-fixture.test.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT/);
});

test('backend wrapper selects fixed Windows and POSIX Maven commands with correct cwd', (t) => {
  const rootDir = fixture(t, { 'backend/mvnw': '', 'backend/mvnw.cmd': '' });
  for (const platform of ['win32', 'linux', 'darwin']) {
    let calls = 0;
    const status = runBackendTests({ rootDir, platform, ...quiet, run(command, args, options) {
      calls += 1;
      assert.equal(command, platform === 'win32' ? 'cmd.exe' : './mvnw');
      assert.deepEqual(args, platform === 'win32' ? ['/d', '/s', '/c', 'mvnw.cmd test'] : ['test']);
      assert.equal(options.cwd, path.join(rootDir, 'backend'));
      assert.equal(options.stdio, 'inherit');
      return { status: 7 };
    } });
    assert.equal(status, 7);
    assert.equal(calls, 1);
  }
});

test('backend wrapper rejects missing wrappers and propagates launch failures', (t) => {
  const rootDir = fixture(t);
  assert.equal(runBackendTests({ rootDir, ...quiet, run() { assert.fail('must not spawn'); } }), 1);
  mkdirSync(path.join(rootDir, 'backend'));
  writeFileSync(path.join(rootDir, 'backend/mvnw'), '');
  for (const outcome of [{ status: null, error: new Error('ENOENT') }, { signal: 'SIGTERM' }, {}, new Error('spawn threw')]) {
    assert.equal(runBackendTests({ rootDir, platform: 'linux', ...quiet, run() {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    } }), 1);
  }
});

test('root frontend commands delegate to existing scripts without replacing them', () => {
  const root = JSON.parse(readFileSync(path.join(here, '../package.json'), 'utf8'));
  const frontend = JSON.parse(readFileSync(path.join(here, '../frontend/package.json'), 'utf8'));
  for (const [command, target] of Object.entries({ 'lint:frontend': 'lint', 'typecheck:frontend': 'typecheck', 'test:frontend:unit': 'test:unit', 'test:frontend:contracts': 'test:contracts', 'build:frontend': 'build' })) {
    assert.equal(root.scripts[command], `npm --prefix frontend run ${target}`);
    assert.equal(typeof frontend.scripts[target], 'string');
  }
});

test('round-close fixture redirects every state output and rejects checkout paths', (t) => {
  const rootDir = fixture(t, { 'TASKS.md': '# Fixture tasks\n' });
  const options = roundCloseFixtureOptions({ tasks: path.join(rootDir, 'TASKS.md'), write: true });
  assert.equal(options.agentSyncJson, path.join(rootDir, '.workspace/state/AGENT_SYNC.json'));
  assert.equal(options.qualityAudit, path.join(rootDir, '.workspace/state/QUALITY_AUDIT.md'));
  assert.equal(options.telemetryJson, path.join(rootDir, '.workspace/state/AUTO_HERMES_TELEMETRY.json'));
  assert.equal(options.write, true);
  assert.throws(() => roundCloseFixtureOptions({ tasks: path.join(rootDir, 'TASKS.md'), agentSyncJson: path.resolve(here, '../.workspace/state/AGENT_SYNC.json') }), /agentSyncJson must stay inside the fixture/);
  assert.throws(() => roundCloseFixtureOptions({ tasks: path.resolve(here, '../TASKS.md') }), /temporary fixture/);
});
