import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') process.exit(77);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = mkdtempSync(path.join(os.tmpdir(), 'hermes windows launcher '));
try {
  mkdirSync(path.join(fixture, 'tools'));
  copyFileSync(path.join(root, 'start_hermes.bat'), path.join(fixture, 'start_hermes.bat'));
  const windows = process.env.SystemRoot;
  const env = { ...process.env, HERMES_NO_PAUSE: '1', HERMES_ALLOW_CROSS_TREE_START: '',
    PATH: [path.join(windows, 'System32'), path.join(windows, 'System32/WindowsPowerShell/v1.0')].join(path.delimiter) };
  for (const code of [5, 17, 4, 2]) {
    writeFileSync(path.join(fixture, 'tools/assert-runtime-owner.ps1'), [
      'param([string]$ProjectRoot,[string]$GuardFile)',
      "Get-Command Get-FileHash -ErrorAction Stop | Out-Null",
      "Write-Output ('[fixture] Guard ran with ' + $PSVersionTable.PSEdition)",
      ...(code === 2 ? ["Set-Content -LiteralPath $GuardFile -Value 'C:\\AnotherHermes'"] : []),
      `exit ${code}`, '',
    ].join('\r\n'));
    const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start_hermes.bat'], {
      cwd: fixture, env, encoding: 'utf8', windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Guard ran with Desktop/, 'The launcher must work without PowerShell 7 on PATH');
    if (code === 4) assert.match(result.stdout, /cannot verify who owns :8080/);
    else if (code === 2) assert.match(result.stdout, /CROSS-TREE START BLOCKED/);
    else {
      assert.match(result.stdout, /Could not run the port ownership check/);
      assert.doesNotMatch(result.stdout, /Something is LISTENING/);
    }
  }
  // The reviewed-release preflight must also use the built-in host, and its failure must reach the calling terminal.
  mkdirSync(path.join(fixture, 'backend'));
  writeFileSync(path.join(fixture, 'backend/reviewed-release.json'), '{}');
  copyFileSync(path.join(root, 'tools/run-backend.cmd'), path.join(fixture, 'tools/run-backend.cmd'));
  writeFileSync(path.join(fixture, 'tools/assert-runtime-owner.ps1'), 'param([string]$ProjectRoot,[string]$GuardFile)\r\nexit 0\r\n');
  writeFileSync(path.join(fixture, 'tools/run-reviewed-release.ps1'), "param([switch]$CheckOnly)\r\nGet-Command Get-FileHash -ErrorAction Stop | Out-Null\r\nWrite-Output ('[fixture] Reviewed preflight ran with ' + $PSVersionTable.PSEdition)\r\nexit 7\r\n");
  const failedPreflight = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start_hermes.bat'], {
    cwd: fixture, env, encoding: 'utf8', windowsHide: true,
  });
  assert.ifError(failedPreflight.error);
  assert.equal(failedPreflight.status, 1, failedPreflight.stdout + failedPreflight.stderr);
  assert.match(failedPreflight.stdout, /Reviewed preflight ran with Desktop/);
  assert.doesNotMatch(failedPreflight.stdout, /Stopping old backend|Waking up Spring Boot/);
  console.log('PASS Windows PowerShell launcher works without pwsh and distinguishes check failures from unknown/foreign owners');
} finally { rmSync(fixture, { recursive: true, force: true }); }
