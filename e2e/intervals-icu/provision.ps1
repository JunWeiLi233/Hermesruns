param(
    [ValidateSet('Seed','PrepareCleanup','VerifyCleanup')][string]$Phase='Seed',
    [Parameter(Mandatory)][string]$RunDirectory
)
$ErrorActionPreference='Stop'
if ($Phase -eq 'Seed') {
    & node (Join-Path $PSScriptRoot 'provision-isolated.mjs') $RunDirectory
} else {
    $cleanupPhase = if ($Phase -eq 'PrepareCleanup') {'--prepare'} else {'--verify'}
    & node (Join-Path $PSScriptRoot 'cleanup.mjs') $cleanupPhase --run $RunDirectory
}
if ($LASTEXITCODE -ne 0) { throw 'Disposable QA fixture operation failed.' }
