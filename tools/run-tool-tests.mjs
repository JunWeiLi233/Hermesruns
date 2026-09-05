#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// File-level skips must be explicit. A zero exit with some skipped assertions is still a passed file.
export const SKIP_EXIT_CODE = 77;

export function discoverToolTests(rootDir = repositoryRoot) {
  const files = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.test.mjs')) files.push(file);
    }
  }
  walk(path.resolve(rootDir, 'tools'));
  return files.sort();
}

function resolveTestFile(rootDir, file) {
  const toolsDir = realpathSync(path.resolve(rootDir, 'tools'));
  const resolved = path.resolve(rootDir, file);
  const relative = path.relative(toolsDir, realpathSync(resolved));
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
      || !resolved.endsWith('.test.mjs') || !lstatSync(resolved).isFile()) {
    throw new Error(`Only regular tools/**/*.test.mjs files may run: ${file}`);
  }
  return resolved;
}

export function runToolTests({
  rootDir = repositoryRoot,
  files,
  run = spawnSync,
  log = console.log,
  error = console.error,
} = {}) {
  rootDir = path.resolve(rootDir);
  const selected = files ?? discoverToolTests(rootDir);
  if (selected.length === 0) throw new Error('No tools/**/*.test.mjs files found.');
  // Validate the complete selection before starting any child process.
  const testFiles = [...new Set(selected.map((file) => resolveTestFile(rootDir, file)))].sort();
  const summary = { total: testFiles.length, passed: 0, failed: 0, skipped: 0, exitCode: 0, results: [] };

  for (const file of testFiles) {
    const name = path.relative(rootDir, file).split(path.sep).join('/');
    log(`[tool-tests] RUN ${name}`);
    let child;
    try {
      child = run(process.execPath, [file], {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      });
    } catch (error) {
      child = { status: null, error };
    }

    const status = child.error || child.signal || child.status === null || child.status === undefined
      ? 'failed'
      : child.status === SKIP_EXIT_CODE ? 'skipped' : child.status === 0 ? 'passed' : 'failed';
    const reason = child.error?.message || (child.signal ? `signal ${child.signal}` : `exit ${child.status ?? 'unknown'}`);
    summary[status] += 1;
    summary.results.push({ file: name, status, exitCode: child.status ?? null, reason });
    log(`[tool-tests] ${status.toUpperCase()} ${name} (${reason})`);
    if (status !== 'passed') {
      if (child.stdout) log(String(child.stdout).trimEnd());
      if (child.stderr) error(String(child.stderr).trimEnd());
    }
    if (status === 'failed' && summary.exitCode === 0) {
      summary.exitCode = Number.isInteger(child.status) && child.status > 0 && child.status !== SKIP_EXIT_CODE
        ? child.status : 1;
    }
  }

  if (summary.passed === 0 && summary.failed === 0) summary.exitCode = 1;
  log(`[tool-tests] Test files: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped (${summary.total} total).`);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const files = process.argv.slice(2);
    process.exitCode = runToolTests({ files: files.length ? files : undefined }).exitCode;
  } catch (error) {
    console.error(`[tool-tests] ${error.message}`);
    process.exitCode = 1;
  }
}
