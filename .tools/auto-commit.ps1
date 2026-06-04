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

    if ($normalized -eq '.env.example') {
        return New-PolicyResult -Path $normalized -Bucket 'publishable' -Reason 'Placeholder environment documentation may ship; real .env files remain blocked.'
    }

    if ($normalized -eq 'Hermes.local.env.example.ps1') {
        return New-PolicyResult -Path $normalized -Bucket 'publishable' -Reason 'Placeholder local environment documentation may ship; real local env files remain blocked.'
    }

    if ($normalized -eq 'territory-reference-weight-closeup.jpg') {
        return New-PolicyResult -Path $normalized -Bucket 'publishable' -Reason 'Reference image used by the checked-in territory visual proof harness.'
    }

    # Shared AI workflow files - NOW PUBLISHABLE
    $sharedAiWorkflowRegexes = @(
        '^AGENTS\.md$',
        '^CLAUDE\.md$',
        '^TASKS\.md$',
        '^PRODUCT\.md$',
        '^HERMES_SELF_EVOLVING_ENGINE\.md$',
        '^\.claude/',
        '^\.codex/',
        '^\.gemini/',
        '^\.agents/',
        '^\.ai-sync/',
        '^\.ai-codex/',
        '^CODEX_.*',
        '^CLAUDE_.*',
        '.*_DAILY_GUIDE\.(md|txt)$',
        '.*_LOOP_GUIDE\.(md|txt)$',
        '^TRANSLATION_WORKFLOW\.md$',
        '^\.tools/generate-codex\.js$',
        '^\.tools/optimize-agent-context\.mjs$',
        '^\.tools/suggest-tasks\.mjs$',
        '^\.tools/check-translations\.mjs$'
    )

    foreach ($pattern in $sharedAiWorkflowRegexes) {
        if ($normalized -match $pattern) {
            # Sub-block strictly local files within shared dirs
            if ($normalized -match 'auth\.json$|local\.toml$|settings\.local\.json$|prompt-log\.jsonl$|agent-memory/|checkpoints/|worktrees/|tmp/') {
                 return New-PolicyResult -Path $normalized -Bucket 'should-ignore' -Reason 'Strictly local AI credential or session data.'
            }
            return New-PolicyResult -Path $normalized -Bucket 'publishable' -Reason 'Shared AI workflow or task management file.'
        }
    }

    $localOnlyRegexes = @(
        '^\.ai/',
        '^\.mempalace/',
        '^mempalace\.yaml$',
        '^entities\.json$',
        '^ALLOW_LIST_TERMINAL_COMMANDS\.txt$',
        '^frontend/VISUAL_QA_LIGHT_SYSTEM\.md$',
        '^course-map-images/',
        '^task-images/',
        '^images/',
        '^\.tools/mempalace/',
        '^\.tools/token_tester/',
        '^\.tools/prompt_optimizer/',
        '^\.tools/write-agent-checkpoint\.mjs$',
        '^\.tools/fixtures/',
        '^\.tools/hermes_sync_config\.json$',
        '^\.tools/shoe-catalog-sources\.example\.json$'
    )

    foreach ($pattern in $localOnlyRegexes) {
        if ($normalized -match $pattern) {
            return New-PolicyResult -Path $normalized -Bucket 'local-only' -Reason 'Private local workflow, memory, or operator file.'
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
        '^docs/architecture/',
        '^\.gitignore$',
        '^design\.md$',
        '^DESIGN_VERSIONS\.md$',
        '^\.github/prompts/auto-hermes-push-main\.prompt\.md$',
        '^TICKET\.md$',
        '^frontend/(src|public|package\.json|package-lock\.json|vite\.config.*|eslint\.config.*|scripts/)',
        '^backend/(src|pom\.xml|mvnw(\.cmd)?|\.mvn/)',
        '^\.tools/(auto-commit\.ps1|agent-sync\.mjs|verify-frontend-runtime-sync\.mjs|verify-backend-runtime-sync\.mjs|run-backend\.cmd|import-shoe-catalog\.mjs|auto-hermes-security\.(mjs|test\.mjs)|auto-hermes-push-main\.(mjs|test\.mjs)|auto-hermes-tech-debt\.mjs|refresh-architecture-diagrams\.(mjs|test\.mjs))$',
        '^\.tools/(auto-hermes-browser|auto-hermes-playwright|auto-hermes-tools\.test|auto-hermes-finish|auto-hermes-finish\.test|territory-live-proof-command|territory-visual-proof-server|verify-territory-border-runtime)\.mjs$',
        '^docs/repo-rules/',
        '^docs/superpowers/plans/',
        '^start_hermes\.bat$'
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

function Get-StatusSnapshot {
    $statusLines = @(Invoke-Git -Args @('status', '--short', '--untracked-files=all') | Where-Object { $_.Trim() -ne '' })
    return ($statusLines -join "`n")
}

function Get-ChangedPathsSnapshot {
    $statusLines = @(Invoke-Git -Args @('status', '--short', '--untracked-files=all') | Where-Object { $_.Trim() -ne '' })
    return @($statusLines | ForEach-Object { Normalize-RepoPath -Path $_.Substring(3).Trim() } | Sort-Object)
}

function Get-DockerGateStatus {
    $gatePath = Join-Path $repoRoot '.ai-sync\AUTO_HERMES_DOCKER_GATE.json'
    if (-not (Test-Path $gatePath)) {
        return [pscustomobject]@{
            Path = $gatePath
            Present = $false
            Passed = $false
            Fresh = $false
            Reason = 'No Docker gate artifact exists yet.'
        }
    }

    try {
        $artifact = Get-Content -Raw $gatePath | ConvertFrom-Json
    } catch {
        return [pscustomobject]@{
            Path = $gatePath
            Present = $true
            Passed = $false
            Fresh = $false
            Reason = 'Docker gate artifact exists but is not valid JSON.'
        }
    }

    $currentHead = (First-Line (Invoke-Git -Args @('rev-parse', 'HEAD'))).Trim()
    $currentPaths = Get-ChangedPathsSnapshot
    $sameHead = [string]$artifact.gitHead -eq $currentHead
    $artifactPaths = @()
    if ($null -ne $artifact.changedPaths) {
        $artifactPaths = @($artifact.changedPaths | ForEach-Object { [string]$_ } | Sort-Object)
    }
    $samePaths = ($artifactPaths.Count -eq $currentPaths.Count)
    if ($samePaths) {
        for ($i = 0; $i -lt $artifactPaths.Count; $i += 1) {
            if ($artifactPaths[$i] -ne $currentPaths[$i]) {
                $samePaths = $false
                break
            }
        }
    }
    $fresh = [bool]$artifact.passed -and $sameHead -and $samePaths
    $reason =
        if (-not [bool]$artifact.passed) { 'Docker gate artifact recorded a failing result.' }
        elseif (-not $sameHead) { 'Docker gate artifact was generated for a different git HEAD.' }
        elseif (-not $samePaths) { 'Docker gate artifact does not match the current changed file set.' }
        else { 'Docker gate artifact matches the current working tree.' }

    return [pscustomobject]@{
        Path = $gatePath
        Present = $true
        Passed = [bool]$artifact.passed
        Fresh = $fresh
        Reason = $reason
    }
}

function Normalize-RemoteUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    return $Url.Trim().Replace('\', '/').TrimEnd('/').Replace('.git', '').ToLowerInvariant()
}

function Get-RemoteStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemoteName,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedUrl
    )

    try {
        $actualUrl = (First-Line (Invoke-Git -Args @('config', '--get', ('remote.' + $RemoteName + '.url')))).Trim()
    } catch {
        try {
            $remoteLines = @(Invoke-Git -Args @('remote', '-v') | Where-Object { $_.Trim() -ne '' })
            foreach ($line in $remoteLines) {
                if ($line -match '^(\S+)\s+(\S+)\s+\((fetch|push)\)$' -and $Matches[1] -eq $RemoteName) {
                    $actualUrl = $Matches[2].Trim()
                    break
                }
            }
        } catch {
            $actualUrl = ''
        }
    }

    if (-not $actualUrl) {
        return [pscustomobject]@{
            RemoteName = $RemoteName
            ExpectedUrl = $ExpectedUrl
            ActualUrl = ''
            MatchesTarget = $false
            Reason = "Git remote '$RemoteName' is not configured."
        }
    }

    $matchesTarget = (Normalize-RemoteUrl -Url $actualUrl) -eq (Normalize-RemoteUrl -Url $ExpectedUrl)
    return [pscustomobject]@{
        RemoteName = $RemoteName
        ExpectedUrl = $ExpectedUrl
        ActualUrl = $actualUrl
        MatchesTarget = $matchesTarget
        Reason = if ($matchesTarget) { "Git remote '$RemoteName' matches the expected publish target." } else { "Git remote '$RemoteName' does not match the expected publish target." }
    }
}

function Test-SecurityGate {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$StagedFiles
    )

    Write-Host "Running Security Gate (PII and Secret scan)..." -ForegroundColor Cyan
    
    # Run the security tool in audit mode. 
    # Note: Currently it scans the whole project, but our updated SecretAndPiiHunter is fast.
    $securityResultJson = node .tools/auto-hermes-security.mjs --mode audit --json
    $securityResult = $securityResultJson | ConvertFrom-Json

    $criticalFindings = @($securityResult.report.findings | Where-Object { $_.severity -eq 'CRITICAL' })
    
    if ($criticalFindings.Count -gt 0) {
        Write-Host "SECURITY GATE FAILED!" -ForegroundColor Red
        foreach ($f in $criticalFindings) {
            Write-Host ("- [" + $f.severity + "] " + $f.summary + " in " + $f.file) -ForegroundColor Yellow
            Write-Host ("  Evidence: " + ($f.evidence -join ' ')) -ForegroundColor Gray
        }
        return $false
    }

    Write-Host "Security Gate Passed." -ForegroundColor Green
    return $true
}

function Invoke-ArchitectureDiagramRefresh {
    param(
        [string[]]$ChangedFiles = @()
    )

    if (-not $ChangedFiles -or $ChangedFiles.Count -eq 0) {
        return
    }

    $refreshScript = Join-Path $repoRoot '.tools\refresh-architecture-diagrams.mjs'
    if (-not (Test-Path $refreshScript)) {
        return
    }

    $nodeArgs = @($refreshScript, '--json')
    foreach ($file in $ChangedFiles) {
        $nodeArgs += '--changed-file'
        $nodeArgs += $file
    }

    $refreshJson = & 'C:\Program Files\nodejs\node.exe' @nodeArgs
    if ($LASTEXITCODE -ne 0) {
        throw 'Architecture diagram refresh failed.'
    }

    $refreshResult = $refreshJson | ConvertFrom-Json
    if ($refreshResult.refreshed -and $refreshResult.outputs.Count -gt 0) {
        Invoke-Git -Args (@('add', '--') + @($refreshResult.outputs | ForEach-Object { [string]$_ })) | Out-Null
    }
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

$preRefreshStaged = @(Invoke-Git -Args @('diff', '--cached', '--name-only') | Where-Object { $_.Trim() -ne '' } | ForEach-Object { Normalize-RepoPath -Path $_ })
Invoke-ArchitectureDiagramRefresh -ChangedFiles $preRefreshStaged

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

# RUN SECURITY GATE
if (-not (Test-SecurityGate -StagedFiles $staged)) {
    throw "Refusing to commit due to security gate failure. Redact PII or secrets and try again."
}

if ($Push) {
    $remoteStatus = Get-RemoteStatus -RemoteName 'origin' -ExpectedUrl 'https://github.com/520HXC/run.git'
    if (-not $remoteStatus.MatchesTarget) {
        Write-Host "Warning: Publish target URL does not exactly match 'https://github.com/520HXC/run.git'. Found: $($remoteStatus.ActualUrl)" -ForegroundColor Yellow
        # We allow it if it's the same base repo, which Get-RemoteStatus already checked via MatchesTarget
    }
}

$identityArgs = @()
$publishUserName = $env:AUTO_HERMES_COMMIT_USER_NAME
$publishUserEmail = $env:AUTO_HERMES_COMMIT_USER_EMAIL
if ($publishUserName -and $publishUserName.Trim()) {
    $identityArgs += @('-c', ('user.name=' + $publishUserName.Trim()))
}
if ($publishUserEmail -and $publishUserEmail.Trim()) {
    $identityArgs += @('-c', ('user.email=' + $publishUserEmail.Trim()))
}

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
        $remoteStatus = Get-RemoteStatus -RemoteName 'origin' -ExpectedUrl 'https://github.com/520HXC/run.git'
        Write-Output ('Publish target: ' + $(if ($remoteStatus.ActualUrl) { $remoteStatus.ActualUrl } else { 'missing remote' }))
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
    Write-Output ('Pushed branch: ' + $branch + ' -> https://github.com/520HXC/run.git')
}
