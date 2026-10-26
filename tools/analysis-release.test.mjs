import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') process.exit(77);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = mkdtempSync(path.join(os.tmpdir(), 'hermes-analysis-release-'));
try {
  const script = path.join(fixture, 'probe.ps1');
  writeFileSync(script, `
param([string]$Workspace, [switch]$Complete, [switch]$OldFrontend)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$jarPath = Join-Path $PSScriptRoot 'backend.jar'
$zip = [IO.Compression.ZipFile]::Open($jarPath, [IO.Compression.ZipArchiveMode]::Create)
try {
  # A frontend-only build resembles the regression: the chart ships without its controller.
  $null = $zip.CreateEntry('BOOT-INF/classes/static/index.html')
  if ($Complete) {
    $contract = Get-Content (Join-Path $Workspace 'tools/analysis-release-contract.json') -Raw | ConvertFrom-Json
    foreach ($name in $contract.classes) {
      $null = $zip.CreateEntry('BOOT-INF/classes/com/hermes/backend/' + $name + '.class')
    }
    if (-not $OldFrontend) {
      $entry = $zip.CreateEntry('BOOT-INF/classes/static/assets/analysis.js')
      $writer = [IO.StreamWriter]::new($entry.Open())
      try { $writer.Write(($contract.frontendMarkers -join ' ')) } finally { $writer.Dispose() }
    }
  }
} finally { $zip.Dispose() }
& (Join-Path $Workspace 'tools/assert-analysis-release.ps1') -JarPath $jarPath
`);
  for (const mode of ['missing-backend', 'old-frontend', 'complete']) {
    const complete = mode !== 'missing-backend';
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
      '-Workspace', root, ...(complete ? ['-Complete'] : []), ...(mode === 'old-frontend' ? ['-OldFrontend'] : [])], { encoding: 'utf8', windowsHide: true });
    assert.ifError(result.error);
    if (mode === 'complete') assert.equal(result.status, 0, result.stderr);
    else {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, mode === 'old-frontend' ? /frontend is missing embedded analysis/ : /Release is missing the merged analysis/);
    }
    // Each invocation creates a fresh archive.
    rmSync(path.join(fixture, 'backend.jar'));
  }
  console.log('PASS analysis release rejects missing API classes and accepts a complete backend');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
