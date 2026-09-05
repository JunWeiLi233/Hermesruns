import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publisherSource = readFileSync(path.join(root, 'tools/auto-commit.ps1'), 'utf8');
assert.match(publisherSource, /\$nodeArgs = @\(\$refreshScript, '--json', '--force'\)/);
assert.doesNotMatch(publisherSource, /\$nodeArgs \+= '--changed-file'/, 'Large migrations must not put every staged path on the Windows command line.');
const cases = [
  ['tools/check-architecture.mjs', false, 'publishable'],
  ['tools/unreviewed-helper.mjs', false, 'review'],
  ['Hermes.code-workspace', false, 'publishable'],
  ['private.code-workspace', false, 'should-ignore'],
  ['.workspace/state/AGENT_SYNC.md', false, 'local-only'],
  ['.workspace/codex/CODEX_CHECKPOINT.md', false, 'local-only'],
  ['.workspace/cache/build.json', false, 'local-only'],
  ['.workspace/tmp/pr-body.md', false, 'local-only'],
  ['backend/src/main/resources/static/index.html', false, 'should-ignore'],
  ['backend/src/main/resources/static/index.html', true, 'publishable'],
  ['.ai-sync/private-report.json', true, 'publishable'],
  ['.tools/old-helper.mjs', true, 'publishable'],
  ['.codex/auth.json', false, 'should-ignore'],
  ['.env', false, 'should-ignore'],
];
const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repoRoot = $env:HERMES_POLICY_ROOT
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $repoRoot 'tools/auto-commit.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Publisher has PowerShell parse errors' }
foreach ($name in @('Normalize-RepoPath', 'New-PolicyResult', 'Get-PathPolicy')) {
  $definition = $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]}, $true) | Where-Object Name -eq $name | Select-Object -First 1
  . ([scriptblock]::Create($definition.Extent.Text))
}
$cases = $env:HERMES_POLICY_CASES | ConvertFrom-Json
@($cases | ForEach-Object { Get-PathPolicy -Path $_[0] -TrackedDeletion:([bool]$_[1]) }) | ConvertTo-Json -Compress
`;
const result = spawnSync(process.platform === 'win32' ? 'powershell.exe' : 'pwsh', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
  cwd: root, encoding: 'utf8', windowsHide: true,
  env: { ...process.env, HERMES_POLICY_ROOT: root, HERMES_POLICY_CASES: JSON.stringify(cases) },
});
if (result.error?.code === 'ENOENT') {
  console.error('PowerShell is required for the publisher policy checks.');
  process.exit(77);
}
assert.equal(result.status, 0, result.stderr || result.error?.message);
const results = JSON.parse(result.stdout.trim());
assert.equal(results.length, cases.length);
results.forEach((policy, index) => assert.equal(policy.Bucket, cases[index][2], cases[index][0]));
console.log('[PASS] Publisher accepts reviewed source/deletions and rejects local state.');
