param(
    [string]$RulesPath = "$env:USERPROFILE\.codex\rules\default.rules"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $RulesPath)) {
    throw "Rules file not found: $RulesPath"
}

$raw = Get-Content -LiteralPath $RulesPath -Raw
$lines = $raw -split "`r?`n" | Where-Object { $_.Trim() }

$keepPatterns = @(
    'codex --help',
    'npm install',
    'npm run build',
    'cd frontend; npm run build',
    'cd frontend; npm run lint',
    'node scripts/run-vite-build.mjs',
    'node frontend/scripts/run-vite-build.mjs',
    'node frontend\scripts\run-vite-build.mjs',
    'python -m pip install tiktoken',
    'python -m pip install mempalace'
)

$kept = New-Object System.Collections.Generic.List[string]
foreach ($line in $lines) {
    foreach ($pattern in $keepPatterns) {
        if ($line -like "*$pattern*") {
            $kept.Add($line)
            break
        }
    }
}

$unique = $kept | Select-Object -Unique
$backupPath = "$RulesPath.bak-" + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item -LiteralPath $RulesPath -Destination $backupPath -Force

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($RulesPath, (($unique -join [Environment]::NewLine) + [Environment]::NewLine), $utf8NoBom)

Write-Host "Backed up rules to $backupPath"
Write-Host ("Kept {0} of {1} rules" -f $unique.Count, $lines.Count)
