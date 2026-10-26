[CmdletBinding()]
param([switch]$CheckOnly)

# An existing local administrator enrolls a passkey without putting a setup
# token in a config file, command line, or temporary batch script.
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$backendRoot = Join-Path $projectRoot 'backend'
$localEnvPath = Join-Path $projectRoot 'Hermes.local.env.ps1'
$runtimePath = Join-Path $env:USERPROFILE '.hermes\runtime.json'
. (Join-Path $PSScriptRoot 'admin-enrollment-config.ps1')

function Get-ProcessEnvironment {
    $result = @{}
    foreach ($entry in [Environment]::GetEnvironmentVariables('Process').GetEnumerator()) {
        $result[$entry.Key] = [string]$entry.Value
    }
    return $result
}

function Set-ProcessEnvironment([hashtable]$Values) {
    foreach ($key in @([Environment]::GetEnvironmentVariables('Process').Keys)) {
        if (-not $Values.ContainsKey($key)) {
            [Environment]::SetEnvironmentVariable([string]$key, [NullString]::Value, 'Process')
        }
    }
    foreach ($key in $Values.Keys) {
        [Environment]::SetEnvironmentVariable([string]$key, [string]$Values[$key], 'Process')
    }
}

if (-not (Test-Path -LiteralPath $localEnvPath)) {
    throw 'Hermes.local.env.ps1 is missing. This helper uses your existing local admin and database configuration.'
}
$previousEnvironment = Get-ProcessEnvironment
try {
    . $localEnvPath *> $null
    $serverEnvironment = Get-ProcessEnvironment
} finally {
    Set-ProcessEnvironment $previousEnvironment
}

if ($serverEnvironment['HERMES_ENV'] -and
        $serverEnvironment['HERMES_ENV'].Trim() -ine 'development') {
    throw 'This helper is for development on this PC. Use the protected admin hostname for production.'
}
if ($serverEnvironment['HERMES_ADMIN_ACCESS_ENABLED'] -ieq 'true') {
    throw 'This instance requires Cloudflare Access. Sign in through its protected hostname.'
}
$databaseUrl = $serverEnvironment['APP_DB_URL']
if ($databaseUrl -and $databaseUrl.StartsWith('jdbc:postgresql:')) {
    $databaseUri = [Uri]$databaseUrl.Substring(5)
    if ($databaseUri.Host -notin @('localhost', '127.0.0.1', '::1')) {
        throw 'Local enrollment requires a database on this PC.'
    }
} elseif ($databaseUrl -and -not $databaseUrl.StartsWith('jdbc:h2:file:') -and
        -not $databaseUrl.StartsWith('jdbc:h2:mem:')) {
    throw 'This helper supports local PostgreSQL or H2 only.'
}

if (-not (Test-Path -LiteralPath $runtimePath)) {
    throw 'Start Hermes normally once before running this helper.'
}
$runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
if ([IO.Path]::GetFullPath([string]$runtime.projectRoot).TrimEnd('\') -ine $projectRoot) {
    throw 'Port 8080 belongs to another Hermes checkout. Run this helper from the serving checkout.'
}
$backendProcessId = [int]$runtime.pid
$backendProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$backendProcessId"
$listener = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if (-not $backendProcess -or $backendProcess.Name -ine 'java.exe' -or
        $backendProcess.CommandLine -notmatch 'com\.hermes\.backend\.BackendApplication' -or
        -not ($listener | Where-Object { $_.OwningProcess -eq $backendProcessId })) {
    throw 'The runtime marker does not match the running Hermes server. Start Hermes normally and retry.'
}
if ($listener | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }) {
    throw 'Local enrollment requires the server to listen on loopback only.'
}
$javaPath = $backendProcess.ExecutablePath
$javacPath = Join-Path (Split-Path $javaPath) 'javac.exe'
if (-not (Test-Path -LiteralPath $javacPath)) {
    throw 'The serving Java installation needs javac to compile the bootstrap safeguard.'
}
if ($backendProcess.CommandLine -notmatch '(?:"@([^"]+)"|@"([^"]+)"|@([^\s]+))') {
    throw 'The serving backend has no recognizable classpath argfile. Start it with start_hermes.bat first.'
}
$originalArgfile = @($Matches[1], $Matches[2], $Matches[3]) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1
$classpath = (Get-Content -LiteralPath $originalArgfile -Raw).Trim().Trim('"').Replace('\\', '\')
$expectedClasses = Join-Path $backendRoot 'target\classes'
if ($classpath.Split(';') -notcontains $expectedClasses) {
    throw 'The backend classpath does not belong to this checkout.'
}

if ($CheckOnly) {
    Write-Host 'Ready: this checkout serves port 8080 on loopback with a local database.'
    Write-Host 'Enrollment will keep existing passwords and roles, and briefly restart this server.'
    exit 0
}

$sessionRoot = Join-Path $env:USERPROFILE ('.hermes\admin-enrollment\' + [Guid]::NewGuid().ToString('N'))
$overrideClasses = Join-Path $sessionRoot 'classes'
[IO.Directory]::CreateDirectory($overrideClasses) | Out-Null
$sourcePath = Join-Path $backendRoot 'src\main\java\com\hermes\backend\admin\AdminBootstrapConfiguration.java'
& $javacPath '-classpath' "@$originalArgfile" '-d' $overrideClasses $sourcePath
if ($LASTEXITCODE -ne 0) {
    throw 'Bootstrap safeguard compilation failed. The running backend was left untouched.'
}
$argfile = Join-Path $sessionRoot 'classpath.argfile'
$sessionClasspath = $overrideClasses + ';' + $classpath
[IO.File]::WriteAllText($argfile, '"' + $sessionClasspath.Replace('\', '\\') + '"',
    (New-Object Text.UTF8Encoding($false)))
$stdoutPath = Join-Path $sessionRoot 'server.log'
$stderrPath = Join-Path $sessionRoot 'server-error.log'

# Bootstrap already created the existing local account. Do not pass account
# creation credentials to either the enrollment or the normal server session.
$serverEnvironment.Remove('APP_BOOTSTRAP_ADMIN_EMAIL')
$serverEnvironment.Remove('APP_BOOTSTRAP_ADMIN_PASSWORD')
$serverEnvironment.Remove('HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN')
$serverEnvironment['HERMES_ENV'] = 'development'
$serverEnvironment['APP_SERVER_ADDRESS'] = '127.0.0.1'
$serverEnvironment['SERVER_ADDRESS'] = '127.0.0.1'
$serverEnvironment['SERVER_PORT'] = '8080'
$serverEnvironment['PORT'] = '8080'
$serverEnvironment['HERMES_ADMIN_MFA_ENABLED'] = 'true'
$serverEnvironment['HERMES_WEBAUTHN_RP_ID'] = 'localhost'
$serverEnvironment['HERMES_WEBAUTHN_ALLOWED_ORIGINS'] = 'http://localhost:8080'

function Stop-EnrollmentServer([int]$ProcessId) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId"
    if ($process) {
        if ($process.Name -ine 'java.exe' -or
                $process.CommandLine -notmatch 'com\.hermes\.backend\.BackendApplication' -or
                ($process.CommandLine.IndexOf($originalArgfile, [StringComparison]::OrdinalIgnoreCase) -lt 0 -and
                 $process.CommandLine.IndexOf($argfile, [StringComparison]::OrdinalIgnoreCase) -lt 0)) {
            throw 'The tracked process changed. Refusing to stop it.'
        }
        Stop-Process -Id $ProcessId -Force
        Wait-Process -Id $ProcessId -Timeout 15 -ErrorAction SilentlyContinue
    }
}

function Start-EnrollmentServer([string]$Token) {
    $childEnvironment = $serverEnvironment.Clone()
    if ($Token) {
        $childEnvironment['HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN'] = $Token
    }
    $snapshot = Get-ProcessEnvironment
    try {
        Set-ProcessEnvironment $childEnvironment
        $arguments = '-Dspring.devtools.restart.enabled=false -cp "@' + $argfile +
            '" com.hermes.backend.BackendApplication'
        $child = Start-Process -FilePath $javaPath -ArgumentList $arguments -WorkingDirectory $backendRoot `
            -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
        $script:managedBackendProcessId = $child.Id
    } finally {
        Set-ProcessEnvironment $snapshot
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    while ([DateTime]::UtcNow -lt $deadline) {
        $child.Refresh()
        if ($child.HasExited) {
            throw "The backend exited. Read $stdoutPath and $stderrPath locally for diagnostics."
        }
        $ready = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue |
            Where-Object { $_.OwningProcess -eq $child.Id }
        if ($ready) {
            @{ port = 8080; pid = $child.Id; projectRoot = $projectRoot;
               startedAt = [DateTimeOffset]::Now.ToString('o') } |
                ConvertTo-Json -Compress | Set-Content -LiteralPath $runtimePath -Encoding UTF8
            return $child.Id
        }
        Start-Sleep -Milliseconds 500
    }
    Stop-EnrollmentServer $child.Id
    throw "The backend did not start within 60 seconds. Read $stdoutPath locally."
}

function Remove-CompletedBootstrapSettings {
    $config = Get-Content -LiteralPath $localEnvPath -Raw
    $config = Remove-AdminBootstrapAssignments $config
    [IO.File]::WriteAllText($localEnvPath, $config, (New-Object Text.UTF8Encoding($false)))
}

$randomBytes = New-Object byte[] 32
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $random.GetBytes($randomBytes) } finally { $random.Dispose() }
$enrollmentToken = [BitConverter]::ToString($randomBytes).Replace('-', '')
$enrollmentProcessId = $null
$managedBackendProcessId = $null
$originalStopped = $false
try {
    Write-Host 'Restarting this local Hermes server for passkey enrollment...'
    Stop-EnrollmentServer $backendProcessId
    $originalStopped = $true
    $enrollmentProcessId = Start-EnrollmentServer $enrollmentToken
    Write-Host ''
    Write-Host 'Open http://localhost:8080/login in your regular browser.'
    Write-Host 'Sign in with your existing admin email and password.'
    Write-Host 'If needed, read APP_BOOTSTRAP_ADMIN_EMAIL and APP_BOOTSTRAP_ADMIN_PASSWORD in Hermes.local.env.ps1 locally.'
    Write-Host 'For first-time passkey setup, paste this temporary token:'
    Write-Host $enrollmentToken
    Write-Host ''
    Write-Host 'Register your passkey, and save your password and recovery codes in a password manager.'
    Write-Host 'If a passkey is already enrolled, use that passkey or a recovery code.'
    Write-Host 'Keep this terminal open until cleanup completes.'
    Read-Host 'After signing in and saving your credentials, press Enter to remove bootstrap settings' | Out-Null
    Remove-CompletedBootstrapSettings
} finally {
    if ($managedBackendProcessId) {
        Stop-EnrollmentServer $managedBackendProcessId
    }
    $enrollmentToken = $null
    [Array]::Clear($randomBytes, 0, $randomBytes.Length)
    if ($originalStopped) {
        Start-EnrollmentServer '' | Out-Null
        Write-Host 'Hermes is running without an enrollment token or account bootstrap credentials.'
    }
}
