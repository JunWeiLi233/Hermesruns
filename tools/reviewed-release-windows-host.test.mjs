import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') process.exit(77);
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = mkdtempSync(path.join(os.tmpdir(), 'hermes reviewed windows '));
try {
  const probe = path.join(fixture, 'probe.ps1');
  writeFileSync(probe, `
param([string]$Workspace)
$ErrorActionPreference='Stop'
$env:PSModulePath="$PSHOME/Modules;$env:PSModulePath"
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
foreach($folder in @('tools','backend','bin','.private-backups/release')) { New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot $folder) -Force | Out-Null }
foreach($file in @('run-reviewed-release.ps1','assert-analysis-release.ps1','analysis-release-contract.json')) {
 Copy-Item -LiteralPath (Join-Path $Workspace ('tools/'+$file)) -Destination (Join-Path $PSScriptRoot 'tools')
}
# Match real Java's successful stderr output without requiring a particular JDK installation.
Add-Type -TypeDefinition 'public static class FakeJava { public static void Main() { System.Console.Error.WriteLine("openjdk version " + (char)34 + "17.0.18" + (char)34); } }' -OutputAssembly (Join-Path $PSScriptRoot 'bin/java.exe') -OutputType ConsoleApplication
$env:PATH=(Join-Path $PSScriptRoot 'bin')+';'+$env:PATH
$jar=Join-Path $PSScriptRoot '.private-backups/release/backend.jar'
$contract=Get-Content (Join-Path $PSScriptRoot 'tools/analysis-release-contract.json') -Raw | ConvertFrom-Json
$zip=[IO.Compression.ZipFile]::Open($jar,[IO.Compression.ZipArchiveMode]::Create)
try {
 foreach($name in $contract.classes) { $null=$zip.CreateEntry('BOOT-INF/classes/com/hermes/backend/'+$name+'.class') }
 $writer=[IO.StreamWriter]::new($zip.CreateEntry('BOOT-INF/classes/static/assets/analysis.js').Open())
 try { $writer.Write(($contract.frontendMarkers -join ' ')) } finally { $writer.Dispose() }
} finally { $zip.Dispose() }
$manifest=Join-Path $PSScriptRoot '.private-backups/release/manifest.json'
$jarHash=(Get-FileHash $jar).Hash
@{jarSha256=$jarHash} | ConvertTo-Json | Set-Content $manifest
@{ projectRoot=$PSScriptRoot; mode='EXPERIMENTAL'; rules='hermes-road-v4'; jarPath=$jar; jarSha256=$jarHash;
 manifestPath=$manifest; manifestSha256=(Get-FileHash $manifest).Hash; databaseHost='localhost'; databasePort=5432; databaseName='hermes'
} | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'backend/reviewed-release.json')
'$env:APP_DB_URL="jdbc:postgresql://localhost:5432/hermes"; $env:APP_RUN_PLANS_APPROVED_RULESET=$null' | Set-Content (Join-Path $PSScriptRoot 'Hermes.local.env.ps1')
& (Join-Path $PSScriptRoot 'tools/run-reviewed-release.ps1') -CheckOnly
`);
  const result = spawnSync(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probe, '-Workspace', workspace], {
      encoding: 'utf8', windowsHide: true, timeout: 30000,
    });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Reviewed release, configuration and Java verified/);
  console.log('PASS reviewed preflight accepts successful Java stderr output under Windows PowerShell 5.1');
} finally { rmSync(fixture, { recursive: true, force: true }); }
