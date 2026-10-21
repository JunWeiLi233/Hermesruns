import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') process.exit(77);

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = mkdtempSync(path.join(os.tmpdir(), 'hermes launcher '));
try {
  mkdirSync(path.join(fixture, 'tools'));
  mkdirSync(path.join(fixture, 'backend'));
  copyFileSync(path.join(repository, 'tools/run-backend.cmd'), path.join(fixture, 'tools/run-backend.cmd'));
  writeFileSync(path.join(fixture, 'backend/reviewed-release.json'), '{}');
  for (const exitCode of [0, 7]) {
    // Exercise the real helper without loading local secrets or starting a server.
    writeFileSync(path.join(fixture, 'tools/run-reviewed-release.ps1'), `param([switch]$CheckOnly)\nif (-not $CheckOnly) { exit 99 }\nexit ${exitCode}\n`);
    writeFileSync(path.join(fixture, 'probe.cmd'), [
      '@echo off',
      'set "ROOT=caller-root\\"',
      'set "JAVA_HOME=caller-java"',
      'set "CHECK_ONLY=caller-check"',
      'set "LOCAL_ENV_PS1=caller-env"',
      'call "%~dp0tools\\run-backend.cmd" --check-only',
      'set "RESULT=%ERRORLEVEL%"',
      'if not "%ROOT%"=="caller-root\\" exit /b 90',
      'if not "%JAVA_HOME%"=="caller-java" exit /b 91',
      'if not "%CHECK_ONLY%"=="caller-check" exit /b 92',
      'if not "%LOCAL_ENV_PS1%"=="caller-env" exit /b 93',
      'exit /b %RESULT%',
      '',
    ].join('\r\n'));
    const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'probe.cmd'], {
      cwd: fixture, encoding: 'utf8', windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, exitCode, `Backend check must preserve caller variables and exit status.\n${result.stdout}\n${result.stderr}`);
  }
  console.log('PASS backend launcher preserves caller environment and success/failure status');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
