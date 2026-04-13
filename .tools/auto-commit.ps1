[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Message,

    [string[]]$Paths = @(),

    [switch]$Push,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $output = & git @Args
    if ($LASTEXITCODE -ne 0) {
        throw ('git ' + ($Args -join ' ') + ' failed with exit code ' + $LASTEXITCODE)
    }
    return $output
}

function First-Line {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Value
    )

    if ($Value -is [System.Array]) {
        return [string]$Value[0]
    }

    return [string]$Value
}

function Normalize-RepoPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $normalized = $Path.Replace('\', '/').Trim()
    if ($normalized.StartsWith('./')) {
        $normalized = $normalized.Substring(2)
    }
    if ($normalized.StartsWith('/')) {
        $normalized = $normalized.Substring(1)
    }
    return $normalized
}

function New-PolicyResult {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Bucket,
        [Parameter(Mandatory = $true)]
        [string]$Reason
    )

    return [pscustomobject]@{
        Path = $Path
        Bucket = $Bucket
        Reason = $Reason
    }
}

function Get-PathPolicy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $normalized = Normalize-RepoPath -Path $Path

    $localOnlyRegexes = @(
        '^AGENTS\.md$',
        '^CLAUDE\.md$',
        '^TASKS\.md$',
        '^PRODUCT\.md$',
        '^HERMES_SELF_EVOLVING_ENGINE\.md$',
        '^\.claude/',
        '^\.codex/',
        '^\.agents/',
        '^\.ai/',
        '^\.ai-sync/',
        '^\.ai-codex/',
        '^\.mempalace/',
        '^mempalace\.yaml$',
        '^entities\.json$',
        '^CODEX_.*',
        '^CLAUDE_.*',
        '.*_DAILY_GUIDE\.(md|txt)$',
        '.*_LOOP_GUIDE\.(md|txt)$',
        '^ALLOW_LIST_TERMINAL_COMMANDS\.txt$',
        '^TRANSLATION_WORKFLOW\.md$',
        '^frontend/VISUAL_QA_LIGHT_SYSTEM\.md$',
        '^task-images/',
        '^images/',
        '^\.tools/mempalace/',
        '^\.tools/token_tester/',
        '^\.tools/prompt_optimizer/',
        '^\.tools/generate-codex\.js$',
        '^\.tools/optimize-agent-context\.mjs$',
        '^\.tools/suggest-tasks\.mjs$',
        '^\.tools/check-translations\.mjs$',
        '^\.tools/write-agent-checkpoint\.mjs$',
        '^\.tools/fixtures/',
        '^\.tools/hermes_sync_config\.json$',
        '^\.tools/shoe-catalog-sources\.example\.json$'
    )

    foreach ($pattern in $localOnlyRegexes) {
        if ($normalized -match $pattern) {
            return New-PolicyResult -Path $normalized -Bucket 'local-only' -Reason 'Local workflow, memory, reference, or operator file.'
        }
    }

    $shouldIgnoreRegexes = @(
        '^\.env(\..+)?$',
        '^Hermes\.local\.env(\..+)?\.ps1$',
        '(^|/)\.DS_Store$',
        '(^|/)Thumbs\.db$',
        '(^|/)Desktop\.ini$',
        '\.log$',
        '^backend_log\.txt$',
        '\.pid$',
        '\.seed$',
        '(^|/)tmp_',
        '\.(pem|key|p12|pfx|jks)$',
        '^credentials\.json$',
        '^backend/target/',
        '^backend/\.mvn/repository/',
        '^\.m2repo/',
        '^backend/.*\.(mv|lock|trace)\.db$',
        '^frontend/node_modules/',
        '^frontend/dist/',
        '(^|/)(__pycache__|venv|\.venv)(/|$)',
        '\.pyc$',
        '^migration_export/',
        '^run/',
        '^Hermes/',
        '\.code-workspace$',
        '\.(url|lnk|heic|psd|sketch|fig|drawio|csv|tsv)$',
        'export.*\.json$',
        'backup.*\.json$'
    )

    foreach ($pattern in $shouldIgnoreRegexes) {
        if ($normalized -match $pattern) {
            return New-PolicyResult -Path $normalized -Bucket 'should-ignore' -Reason 'Local artifact, secret, cache, or machine-specific file should stay in .gitignore.'
        }
    }

    $publishableRegexes = @(
        '^README\.md$',
        '^\.gitignore$',
        '^design\.md$',
        '^DESIGN_VERSIONS\.md$',
        '^TICKET\.md$',
        '^frontend/(src|public|package\.json|package-lock\.json|vite\.config.*|eslint\.config.*|scripts/)',
        '^backend/(src|pom\.xml|mvnw(\.cmd)?|\.mvn/)',
        '^\.tools/(auto-commit\.ps1|agent-sync\.mjs|verify-frontend-runtime-sync\.mjs|verify-backend-runtime-sync\.mjs|run-backend\.cmd|import-shoe-catalog\.mjs)$'
    )

    foreach ($pattern in $publishableRegexes) {
        if ($normalized -match $pattern) {
            return New-PolicyResult -Path $normalized -Bucket 'publishable' -Reason 'Repo code, product doc, or shared helper that may ship.'
        }
    }

    return New-PolicyResult -Path $normalized -Bucket 'review' -Reason 'Unknown path. Review before auto-staging.'
}

function Join-PolicyMessage {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Items
    )

    return (($Items | ForEach-Object { $_.Path + ' [' + $_.Bucket + '] - ' + $_.Reason }) -join '; ')
}

$repoRoot = (First-Line (Invoke-Git -Args @('rev-parse', '--show-toplevel'))).Trim()
Set-Location $repoRoot
$branch = (First-Line (Invoke-Git -Args @('rev-parse', '--abbrev-ref', 'HEAD'))).Trim()

if ($branch -eq 'HEAD') {
    throw 'Refusing to auto-commit from a detached HEAD state.'
}

$statusLines = @(Invoke-Git -Args @('status', '--short', '--untracked-files=all') | Where-Object { $_.Trim() -ne '' })
$untrackedPaths = @()
foreach ($line in $statusLines) {
    if ($line.Length -ge 4 -and $line.Substring(0, 2) -eq '??') {
        $untrackedPaths += (Normalize-RepoPath -Path $line.Substring(3).Trim())
    }
}

$untrackedPolicies = @($untrackedPaths | ForEach-Object { Get-PathPolicy -Path $_ })
$ignoreLeaks = @($untrackedPolicies | Where-Object { $_.Bucket -eq 'should-ignore' })
if ($ignoreLeaks.Count -gt 0) {
    throw ('Refusing auto-commit until .gitignore covers local-only artifacts: ' + (Join-PolicyMessage -Items $ignoreLeaks))
}

if ($Paths.Count -gt 0) {
    $pathPolicies = @($Paths | ForEach-Object { Get-PathPolicy -Path $_ })
    $blockedPaths = @($pathPolicies | Where-Object { $_.Bucket -in @('local-only', 'should-ignore', 'review') })
    if ($blockedPaths.Count -gt 0) {
        throw ('Refusing to auto-stage risky paths: ' + (Join-PolicyMessage -Items $blockedPaths))
    }
    Invoke-Git -Args (@('add', '--') + $Paths) | Out-Null
}

$staged = @(Invoke-Git -Args @('diff', '--cached', '--name-only') | Where-Object { $_.Trim() -ne '' })
if ($staged.Count -eq 0) {
    throw 'No staged files found. Stage the intended product files first or pass -Paths.'
}

$stagedPolicies = @($staged | ForEach-Object { Get-PathPolicy -Path $_ })
$unsafeStaged = @($stagedPolicies | Where-Object { $_.Bucket -in @('local-only', 'should-ignore', 'review') })
if ($unsafeStaged.Count -gt 0) {
    throw ('Refusing to commit staged files that are not clearly publishable: ' + (Join-PolicyMessage -Items $unsafeStaged))
}

$publishable = @($stagedPolicies | Where-Object { $_.Bucket -eq 'publishable' })
if ($publishable.Count -eq 0) {
    throw 'Refusing to commit without any clearly publishable files.'
}

$identityArgs = @('-c', 'user.name=JunWeiLi233', '-c', 'user.email=mcpejunwei@gmail.com')

if ($DryRun) {
    Write-Output 'Auto-commit dry run'
    Write-Output ('Repo: ' + $repoRoot)
    Write-Output ('Branch: ' + $branch)
    Write-Output ('Message: ' + $Message)
    Write-Output 'Staged files:'
    $staged | ForEach-Object { Write-Output ('- ' + $_) }
    Write-Output 'Policy verdicts:'
    $stagedPolicies | ForEach-Object { Write-Output ('- ' + $_.Path + ': ' + $_.Bucket + ' (' + $_.Reason + ')') }
    Write-Output ('Commit command: git ' + (($identityArgs + @('commit', '-m', $Message)) -join ' '))
    if ($Push) {
        Write-Output ('Push command: git push origin ' + $branch)
    }
    exit 0
}

Invoke-Git -Args ($identityArgs + @('commit', '-m', $Message)) | Out-Null
$author = (First-Line (Invoke-Git -Args @('log', '-1', '--format=%an <%ae>'))).Trim()

Write-Output ('Committed with author ' + $author)
Write-Output 'Committed files:'
$staged | ForEach-Object { Write-Output ('- ' + $_) }

if ($Push) {
    Invoke-Git -Args @('push', 'origin', $branch) | Out-Null
    Write-Output ('Pushed branch: ' + $branch)
}
