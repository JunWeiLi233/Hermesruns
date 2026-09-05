#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function runBackendTests({
  rootDir = repositoryRoot,
  platform = process.platform,
  run = spawnSync,
  error = console.error,
} = {}) {
  const cwd = path.resolve(rootDir, 'backend');
  const windows = platform === 'win32';
  const wrapper = windows ? 'mvnw.cmd' : 'mvnw';
  if (!existsSync(path.join(cwd, wrapper))) {
    error(`[backend-tests] Missing Maven wrapper: ${path.join(cwd, wrapper)}`);
    return 1;
  }
  try {
    // cmd.exe is needed for .cmd files; the command is fixed and cwd handles paths containing spaces.
    const result = run(windows ? 'cmd.exe' : './mvnw', windows ? ['/d', '/s', '/c', 'mvnw.cmd test'] : ['test'], {
      cwd,
      stdio: 'inherit',
      windowsHide: true,
    });
    if (result.error || result.signal) {
      error(`[backend-tests] ${result.error?.message || `Terminated by ${result.signal}`}`);
      return 1;
    }
    return result.status ?? 1;
  } catch (failure) {
    error(`[backend-tests] ${failure.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = runBackendTests();
}
