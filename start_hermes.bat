@echo off

echo ==========================================
echo       STARTING HERMES TECH STACK
echo ==========================================

set "ROOT=%~dp0"
set "HERMES_BACKEND_LOG=%ROOT%backend_log.txt"
set "APP_URL=http://localhost:8080"
set "HEALTH_URL=http://localhost:8080"
set "PYTHON_EXE="
set "SYNC_CONFIG=%ROOT%.tools\hermes_sync_config.json"
set "BOOT_SCRIPT=%TEMP%\hermes_boot_%RANDOM%.cmd"
set "LOCAL_ENV_PS1=%ROOT%Hermes.local.env.ps1"
set "LOCAL_ENV_BOOT=%TEMP%\hermes_env_%RANDOM%.cmd"
set "BACKEND_RETRY_DONE="

if exist "%LOCAL_ENV_PS1%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$ErrorActionPreference = 'Stop';" ^
        "$envPath = [IO.Path]::GetFullPath('%LOCAL_ENV_PS1%');" ^
        "$bootPath = [IO.Path]::GetFullPath('%LOCAL_ENV_BOOT%');" ^
        "$vars = @('APP_DB_URL','APP_DB_DRIVER','APP_DB_USERNAME','APP_DB_PASSWORD','STRAVA_CLIENT_ID','STRAVA_CLIENT_SECRET','STRAVA_REDIRECT_URI','APP_STRAVA_CLIENT_ID','APP_STRAVA_CLIENT_SECRET','APP_STRAVA_REDIRECT_URI','APP_DATA_ENCRYPTION_KEY','APP_GOOGLE_CLIENT_ID','APP_GOOGLE_CLIENT_SECRET','APP_GOOGLE_REDIRECT_URI','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','APP_BOOTSTRAP_ADMIN_EMAIL','APP_BOOTSTRAP_ADMIN_PASSWORD','APP_LOCAL_SHARED_RUNNER_ENABLED','APP_LOCAL_SHARED_RUNNER_EMAIL','APP_LOCAL_SHARED_RUNNER_PASSWORD','APP_LOCAL_SHARED_RUNNER_DISPLAY_NAME','APP_LOCAL_TERRITORY_RIVAL_ENABLED','APP_LOCAL_TERRITORY_RIVAL_EMAIL','APP_LOCAL_TERRITORY_RIVAL_PASSWORD','APP_LOCAL_TERRITORY_RIVAL_DISPLAY_NAME','APP_LOCAL_TERRITORY_FLUSHING_ENABLED','APP_LOCAL_TERRITORY_FLUSHING_EMAIL','APP_LOCAL_TERRITORY_FLUSHING_PASSWORD','APP_LOCAL_TERRITORY_FLUSHING_DISPLAY_NAME','APP_LOCAL_TERRITORY_FLUSHING_INNER_ENABLED','APP_LOCAL_TERRITORY_FLUSHING_INNER_EMAIL','APP_LOCAL_TERRITORY_FLUSHING_INNER_PASSWORD','APP_LOCAL_TERRITORY_FLUSHING_INNER_DISPLAY_NAME','APP_LOCAL_TERRITORY_BERLIN_ENABLED','APP_LOCAL_TERRITORY_BERLIN_EMAIL','APP_LOCAL_TERRITORY_BERLIN_PASSWORD','APP_LOCAL_TERRITORY_BERLIN_DISPLAY_NAME','APP_JPA_DDL_AUTO','APP_AI_API_KEY','APP_AI_MODEL','APP_AI_PROVIDER','APP_AI_COURSE_MAP_PROVIDER','APP_ROUTE_EXTRACTION_PYTHON_COMMAND','APP_ROUTE_EXTRACTION_QWEN_MODEL_ID','APP_ROUTE_EXTRACTION_QWEN_DEVICE_MAP','APP_ROUTE_EXTRACTION_QWEN_CACHE_DIR','APP_ROUTE_EXTRACTION_QWEN_ALIGNMENT_SCRIPT','APP_ROUTE_EXTRACTION_QWEN_PARAMETERS_SCRIPT','APP_ROUTE_EXTRACTION_QWEN_ANCHOR_SCRIPT','APP_CARTO_BASEMAPS_API_KEY','SPRING_MAIL_HOST','SPRING_MAIL_PORT','SPRING_MAIL_USERNAME','SPRING_MAIL_PASSWORD','APP_MAIL_FROM','APP_PUBLIC_BASE_URL','HERMES_ADMIN_MFA_ENABLED','HERMES_WEBAUTHN_RP_ID','HERMES_WEBAUTHN_RP_NAME','HERMES_WEBAUTHN_ALLOWED_ORIGINS','HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN','HERMES_ADMIN_ACCESS_ENABLED','HERMES_ADMIN_ACCESS_TEAM_DOMAIN','HERMES_ADMIN_ACCESS_AUDIENCE','HERMES_ADMIN_ACCESS_ALLOWED_EMAILS','HERMES_ENV','SPRING_PROFILES_ACTIVE','APP_ENABLE_HSTS','APP_CORS_ALLOWED_ORIGINS','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_PRO_MONTHLY');" ^
        ". $envPath;" ^
        "$lines = @(foreach ($name in $vars) { $value = [Environment]::GetEnvironmentVariable($name, 'Process'); if (-not [string]::IsNullOrWhiteSpace($value)) { 'set ""' + $name + '=' + ($value -replace '%%', '%%%%') + '""' } });" ^
        "[IO.File]::WriteAllLines($bootPath, $lines, [Text.Encoding]::ASCII)"
    if errorlevel 1 (
        echo [Hermes] Failed to load local env from Hermes.local.env.ps1.
        del "%LOCAL_ENV_BOOT%" >nul 2>nul
        goto :startup_failed
    )
    call "%LOCAL_ENV_BOOT%"
    del "%LOCAL_ENV_BOOT%" >nul 2>nul
    echo [Hermes] Loaded local env from Hermes.local.env.ps1
) else (
    echo [Hermes] Hermes.local.env.ps1 not found. Using existing shell env only.
)

if exist "%ROOT%.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%ROOT%.venv\Scripts\python.exe"
) else if exist "%ROOT%backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%ROOT%backend\venv\Scripts\python.exe"
)

:: ---- Cross-tree takeover guard ------------------------------------------------
:: Never silently replace another tree's backend on localhost:8080. Identify the
:: tree that currently owns :8080 (runtime marker first, then the Spring Boot
:: argfile of the listening java process) and abort unless it is THIS tree.
:: Resolver exit codes: 0 = same tree, or no listener + no stale foreign marker,
::                      2 = :8080 is owned by another tree,
::                      3 = no listener, but a stale runtime.json names another
::                      tree that was not stopped cleanly,
::                      4 = owner unidentifiable;
::                      any other nonzero errorlevel (unexpected powershell
::                      failure) is also routed to the unknown path below.
set "GUARD_FILE=%TEMP%\hermes_guard_%RANDOM%.txt"
powershell -NoProfile -Command ^
    "$ErrorActionPreference = 'SilentlyContinue';" ^
    "$thisRoot = '%ROOT%'.TrimEnd('\');" ^
    "$marker = Join-Path $env:USERPROFILE '.hermes\runtime.json';" ^
    "$listenerPids = @(netstat -ano | Select-String ':8080\s+.*LISTENING' | ForEach-Object { ($_ -replace '.*\s', '').Trim() } | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' } | Sort-Object -Unique);" ^
    "if ($listenerPids.Count -eq 0) {" ^
    "  if (Test-Path $marker) {" ^
    "    try {" ^
    "      $m = Get-Content $marker -Raw | ConvertFrom-Json;" ^
    "      $markerRoot = ([string]$m.projectRoot).TrimEnd('\');" ^
    "      if ($markerRoot -and $markerRoot -ne $thisRoot) { [IO.File]::WriteAllText('%GUARD_FILE%', $markerRoot, [Text.Encoding]::ASCII); exit 3 }" ^
    "    } catch { }" ^
    "  };" ^
    "  Remove-Item '%GUARD_FILE%' -ErrorAction SilentlyContinue; exit 0" ^
    "};" ^
    "$owner = $null;" ^
    "foreach ($procId in $listenerPids) {" ^
    "  $tree = $null;" ^
    "  $proc = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $procId);" ^
    "  if (Test-Path $marker) {" ^
    "    try {" ^
    "      $m = Get-Content $marker -Raw | ConvertFrom-Json;" ^
    "      if ($m.projectRoot -and ([string]$m.pid) -eq ([string]$procId) -and $proc -and $proc.Name -eq 'java.exe' -and $proc.CommandLine -match 'BackendApplication') { $tree = ([string]$m.projectRoot).TrimEnd('\') }" ^
    "    } catch { }" ^
    "  };" ^
    "  if (-not $tree -and $proc -and $proc.CommandLine -match 'BackendApplication') {" ^
    "    if ($proc.CommandLine -match '@(\S+\.argfile)') {" ^
    "      $argfile = $Matches[1];" ^
    "      if (Test-Path $argfile) {" ^
    "        $cp = (Get-Content $argfile -TotalCount 1).Trim().Trim([char]34).Replace('\\', '\');" ^
    "        $entry = $cp.Split(';')[0];" ^
    "        if ($entry -match '^(.+?)\\backend\\target\\classes$') { $tree = $Matches[1] }" ^
    "      }" ^
    "    };" ^
    "    if (-not $tree) { foreach ($piece in ($proc.CommandLine -split '[ ;]')) { $t = $piece.Trim().Trim([char]34); if ($t -match '^([A-Za-z]:\\.*?)\\backend\\target\\classes') { $tree = $Matches[1]; break } } }" ^
    "  };" ^
    "  if (-not $tree) { Remove-Item '%GUARD_FILE%' -ErrorAction SilentlyContinue; exit 4 };" ^
    "  if ($tree -ne $thisRoot) { $owner = $tree; break }" ^
    "};" ^
    "if ($owner) { [IO.File]::WriteAllText('%GUARD_FILE%', $owner, [Text.Encoding]::ASCII); exit 2 };" ^
    "exit 0"
if errorlevel 4 goto :guard_unknown
if errorlevel 3 goto :guard_stale_marker
if errorlevel 2 goto :guard_cross_tree
if errorlevel 1 goto :guard_unknown
goto :takeover

:guard_cross_tree
for /f "usebackq delims=" %%T in ("%GUARD_FILE%") do set "FOUND_ROOT=%%T"
del "%GUARD_FILE%" >nul 2>nul
echo ==========================================================
echo [Hermes] CROSS-TREE START BLOCKED!
echo [Hermes] Port 8080 is currently served from a DIFFERENT tree:
echo [Hermes]   Serving tree : %FOUND_ROOT%
echo [Hermes]   This tree    : %ROOT%
echo [Hermes] Starting from this tree would silently switch localhost:8080
echo [Hermes] to a different codebase and a different app design.
echo [Hermes] To switch trees on purpose: stop the other tree first
echo [Hermes] (run stop_hermes.bat there), or set HERMES_ALLOW_CROSS_TREE_START=1.
echo ==========================================================
:: 中文警告原文（以下命令向用户输出相同内容，用 [char] 码点以保持本文件为纯 ASCII）：
:: 警告：端口 8080 正由另一个代码目录（树）提供服务。从此目录启动会把应用切换到另一套代码与界面设计。已中止本次启动。如确需切换，请先停止另一个目录的 Hermes，或设置环境变量 HERMES_ALLOW_CROSS_TREE_START=1 后重试。
powershell -NoProfile -Command "Write-Host (-join [char[]](0x8b66,0x544a,0xff1a,0x7aef,0x53e3,0x20,0x38,0x30,0x38,0x30,0x20,0x6b63,0x7531,0x53e6,0x4e00,0x4e2a,0x4ee3,0x7801,0x76ee,0x5f55,0xff08,0x6811,0xff09,0x63d0,0x4f9b,0x670d,0x52a1,0x3002,0x4ece,0x6b64,0x76ee,0x5f55,0x542f,0x52a8,0x4f1a,0x628a,0x5e94,0x7528,0x5207,0x6362,0x5230,0x53e6,0x4e00,0x5957,0x4ee3,0x7801,0x4e0e,0x754c,0x9762,0x8bbe,0x8ba1,0x3002,0x5df2,0x4e2d,0x6b62,0x672c,0x6b21,0x542f,0x52a8,0x3002,0x5982,0x786e,0x9700,0x5207,0x6362,0xff0c,0x8bf7,0x5148,0x505c,0x6b62,0x53e6,0x4e00,0x4e2a,0x76ee,0x5f55,0x7684,0x20,0x48,0x65,0x72,0x6d,0x65,0x73,0xff0c,0x6216,0x8bbe,0x7f6e,0x73af,0x5883,0x53d8,0x91cf,0x20,0x48,0x45,0x52,0x4d,0x45,0x53,0x5f,0x41,0x4c,0x4c,0x4f,0x57,0x5f,0x43,0x52,0x4f,0x53,0x53,0x5f,0x54,0x52,0x45,0x45,0x5f,0x53,0x54,0x41,0x52,0x54,0x3d,0x31,0x20,0x540e,0x91cd,0x8bd5,0x3002))"
if "%HERMES_ALLOW_CROSS_TREE_START%"=="1" (
    echo [Hermes] HERMES_ALLOW_CROSS_TREE_START=1 - cross-tree start FORCED, taking over :8080...
    goto :takeover
)
if not defined HERMES_NO_PAUSE pause
exit /b 1

:guard_stale_marker
for /f "usebackq delims=" %%T in ("%GUARD_FILE%") do set "FOUND_ROOT=%%T"
del "%GUARD_FILE%" >nul 2>nul
echo ==========================================================
echo [Hermes] STALE-MARKER CROSS-TREE START BLOCKED!
echo [Hermes] Port 8080 is FREE, but the runtime marker says the last serving
echo [Hermes] tree was a DIFFERENT tree that was not stopped cleanly
echo [Hermes] (its runtime.json marker was never cleaned up):
echo [Hermes]   Last serving tree : %FOUND_ROOT%
echo [Hermes]   This tree         : %ROOT%
echo [Hermes] Starting from this tree would switch localhost:8080 to a
echo [Hermes] different codebase and a different app design.
echo [Hermes] To switch trees on purpose:
echo [Hermes]   (a) run stop_hermes.bat from the other tree - a clean handover
echo [Hermes]       deletes the marker, or
echo [Hermes]   (b) delete %USERPROFILE%\.hermes\runtime.json yourself, or
echo [Hermes]   (c) set HERMES_ALLOW_CROSS_TREE_START=1.
echo ==========================================================
:: 中文警告原文（以下命令向用户输出相同内容，用 [char] 码点以保持本文件为纯 ASCII）：
:: 警告：端口 8080 当前空闲，但上次提供服务的代码目录（树）不是本目录，且未被干净停止（runtime.json 标记未清理）。从此目录启动会把应用切换到另一套代码与界面设计。已中止本次启动。如确需切换：（a）在另一个目录运行 stop_hermes.bat（会删除标记），（b）手动删除 %USERPROFILE%\.hermes\runtime.json，或（c）设置环境变量 HERMES_ALLOW_CROSS_TREE_START=1 后重试。
powershell -NoProfile -Command "Write-Host (-join [char[]](0x8b66,0x544a,0xff1a,0x7aef,0x53e3,0x20,0x38,0x30,0x38,0x30,0x20,0x5f53,0x524d,0x7a7a,0x95f2,0xff0c,0x4f46,0x4e0a,0x6b21,0x63d0,0x4f9b,0x670d,0x52a1,0x7684,0x4ee3,0x7801,0x76ee,0x5f55,0xff08,0x6811,0xff09,0x4e0d,0x662f,0x672c,0x76ee,0x5f55,0xff0c,0x4e14,0x672a,0x88ab,0x5e72,0x51c0,0x505c,0x6b62,0xff08,0x72,0x75,0x6e,0x74,0x69,0x6d,0x65,0x2e,0x6a,0x73,0x6f,0x6e,0x20,0x6807,0x8bb0,0x672a,0x6e05,0x7406,0xff09,0x3002,0x4ece,0x6b64,0x76ee,0x5f55,0x542f,0x52a8,0x4f1a,0x628a,0x5e94,0x7528,0x5207,0x6362,0x5230,0x53e6,0x4e00,0x5957,0x4ee3,0x7801,0x4e0e,0x754c,0x9762,0x8bbe,0x8ba1,0x3002,0x5df2,0x4e2d,0x6b62,0x672c,0x6b21,0x542f,0x52a8,0x3002,0x5982,0x786e,0x9700,0x5207,0x6362,0xff1a,0xff08,0x61,0xff09,0x5728,0x53e6,0x4e00,0x4e2a,0x76ee,0x5f55,0x8fd0,0x884c,0x20,0x73,0x74,0x6f,0x70,0x5f,0x68,0x65,0x72,0x6d,0x65,0x73,0x2e,0x62,0x61,0x74,0xff08,0x4f1a,0x5220,0x9664,0x6807,0x8bb0,0xff09,0xff0c,0xff08,0x62,0xff09,0x624b,0x52a8,0x5220,0x9664,0x20,0x43,0x3a,0x5c,0x55,0x73,0x65,0x72,0x73,0x5c,0x4a,0x75,0x6e,0x77,0x65,0x69,0x5c,0x2e,0x68,0x65,0x72,0x6d,0x65,0x73,0x5c,0x72,0x75,0x6e,0x74,0x69,0x6d,0x65,0x2e,0x6a,0x73,0x6f,0x6e,0xff0c,0x6216,0xff08,0x63,0xff09,0x8bbe,0x7f6e,0x73af,0x5883,0x53d8,0x91cf,0x20,0x48,0x45,0x52,0x4d,0x45,0x53,0x5f,0x41,0x4c,0x4c,0x4f,0x57,0x5f,0x43,0x52,0x4f,0x53,0x53,0x5f,0x54,0x52,0x45,0x45,0x5f,0x53,0x54,0x41,0x52,0x54,0x3d,0x31,0x20,0x540e,0x91cd,0x8bd5,0x3002))"
if "%HERMES_ALLOW_CROSS_TREE_START%"=="1" (
    echo [Hermes] HERMES_ALLOW_CROSS_TREE_START=1 - cross-tree start FORCED, marker will be refreshed at :open_app...
    goto :takeover
)
if not defined HERMES_NO_PAUSE pause
exit /b 1

:guard_unknown
if exist "%GUARD_FILE%" del "%GUARD_FILE%" >nul 2>nul
echo ==========================================================
echo [Hermes] START BLOCKED - cannot verify who owns :8080.
echo [Hermes] Something is LISTENING on port 8080, but its origin tree could
echo [Hermes] not be identified (no runtime marker and no Spring Boot argfile).
echo [Hermes] Refusing to kill an unidentified process. Stop it manually, or set
echo [Hermes] HERMES_ALLOW_CROSS_TREE_START=1 to force this start.
echo ==========================================================
:: 中文警告原文（以下命令向用户输出相同内容，用 [char] 码点以保持本文件为纯 ASCII）：
:: 警告：端口 8080 已被占用，且无法确认占用进程是否属于本目录。为避免误杀无关进程，已中止启动。请先手动停止占用者，或设置环境变量 HERMES_ALLOW_CROSS_TREE_START=1 后强制启动。
powershell -NoProfile -Command "Write-Host (-join [char[]](0x8b66,0x544a,0xff1a,0x7aef,0x53e3,0x20,0x38,0x30,0x38,0x30,0x20,0x5df2,0x88ab,0x5360,0x7528,0xff0c,0x4e14,0x65e0,0x6cd5,0x786e,0x8ba4,0x5360,0x7528,0x8fdb,0x7a0b,0x662f,0x5426,0x5c5e,0x4e8e,0x672c,0x76ee,0x5f55,0x3002,0x4e3a,0x907f,0x514d,0x8bef,0x6740,0x65e0,0x5173,0x8fdb,0x7a0b,0xff0c,0x5df2,0x4e2d,0x6b62,0x542f,0x52a8,0x3002,0x8bf7,0x5148,0x624b,0x52a8,0x505c,0x6b62,0x5360,0x7528,0x8005,0xff0c,0x6216,0x8bbe,0x7f6e,0x73af,0x5883,0x53d8,0x91cf,0x20,0x48,0x45,0x52,0x4d,0x45,0x53,0x5f,0x41,0x4c,0x4c,0x4f,0x57,0x5f,0x43,0x52,0x4f,0x53,0x53,0x5f,0x54,0x52,0x45,0x45,0x5f,0x53,0x54,0x41,0x52,0x54,0x3d,0x31,0x20,0x540e,0x5f3a,0x5236,0x542f,0x52a8,0x3002))"
if "%HERMES_ALLOW_CROSS_TREE_START%"=="1" (
    echo [Hermes] HERMES_ALLOW_CROSS_TREE_START=1 - forced start despite unknown :8080 owner...
    goto :takeover
)
if not defined HERMES_NO_PAUSE pause
exit /b 1

:takeover
:: Takeover was allowed by the guard (same tree, no listener, no stale foreign
:: marker, or forced).
powershell -NoProfile -Command ^
    "$listener = netstat -ano | Select-String ':8080\s+.*LISTENING'; if ($listener) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
    echo [Hermes] Stopping old backend on localhost:8080...
    powershell -NoProfile -Command ^
        "$pids = netstat -ano | Select-String ':8080\s+.*LISTENING' | ForEach-Object { ($_ -replace '.*\s', '').Trim() } | Sort-Object -Unique; foreach ($procId in $pids) { if ($procId -match '^\d+$' -and $procId -ne '0') { Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue } }"
    timeout /t 2 /nobreak > nul
    powershell -NoProfile -Command ^
        "$remaining = netstat -ano | Select-String ':8080\s+.*LISTENING'; if ($remaining) { exit 1 } else { exit 0 }"
    if errorlevel 1 (
        echo [Hermes] Could not stop the existing backend on localhost:8080.
        echo [Hermes] Close the old Hermes Spring Boot window or stop its Java process, then run start_hermes.bat again.
        goto :startup_failed
    )
)

:: 1. Build frontend static assets before any backend window can serve an old app shell.
echo [1/5] Building frontend static assets...
pushd "%ROOT%frontend"
node scripts\run-vite-build.mjs
if errorlevel 1 (
    echo [Hermes] Frontend build failed. Fix Vite/build errors before starting Hermes.
    popd
    goto :startup_failed
)
popd

:: 2. Check backend requirements before opening any windows
echo [2/5] Checking Spring Boot requirements...
call .tools\run-backend.cmd --check-only
if errorlevel 1 goto :startup_failed

:: 3. Build a temp boot script that carries all env vars into the new window
echo @echo off > "%BOOT_SCRIPT%"
if defined APP_DB_URL               echo set "APP_DB_URL=%APP_DB_URL%">> "%BOOT_SCRIPT%"
if defined APP_DB_DRIVER            echo set "APP_DB_DRIVER=%APP_DB_DRIVER%">> "%BOOT_SCRIPT%"
if defined APP_DB_USERNAME          echo set "APP_DB_USERNAME=%APP_DB_USERNAME%">> "%BOOT_SCRIPT%"
if defined APP_DB_PASSWORD          echo set "APP_DB_PASSWORD=%APP_DB_PASSWORD%">> "%BOOT_SCRIPT%"
if defined STRAVA_CLIENT_ID         echo set "STRAVA_CLIENT_ID=%STRAVA_CLIENT_ID%">> "%BOOT_SCRIPT%"
if defined STRAVA_CLIENT_SECRET     echo set "STRAVA_CLIENT_SECRET=%STRAVA_CLIENT_SECRET%">> "%BOOT_SCRIPT%"
if defined STRAVA_REDIRECT_URI      echo set "STRAVA_REDIRECT_URI=%STRAVA_REDIRECT_URI%">> "%BOOT_SCRIPT%"
if defined APP_STRAVA_CLIENT_ID     echo set "APP_STRAVA_CLIENT_ID=%APP_STRAVA_CLIENT_ID%">> "%BOOT_SCRIPT%"
if defined APP_STRAVA_CLIENT_SECRET echo set "APP_STRAVA_CLIENT_SECRET=%APP_STRAVA_CLIENT_SECRET%">> "%BOOT_SCRIPT%"
if defined APP_STRAVA_REDIRECT_URI  echo set "APP_STRAVA_REDIRECT_URI=%APP_STRAVA_REDIRECT_URI%">> "%BOOT_SCRIPT%"
if defined APP_DATA_ENCRYPTION_KEY  echo set "APP_DATA_ENCRYPTION_KEY=%APP_DATA_ENCRYPTION_KEY%">> "%BOOT_SCRIPT%"
if defined APP_GOOGLE_CLIENT_ID     echo set "APP_GOOGLE_CLIENT_ID=%APP_GOOGLE_CLIENT_ID%">> "%BOOT_SCRIPT%"
if defined APP_GOOGLE_CLIENT_SECRET echo set "APP_GOOGLE_CLIENT_SECRET=%APP_GOOGLE_CLIENT_SECRET%">> "%BOOT_SCRIPT%"
if defined APP_GOOGLE_REDIRECT_URI  echo set "APP_GOOGLE_REDIRECT_URI=%APP_GOOGLE_REDIRECT_URI%">> "%BOOT_SCRIPT%"
if defined GOOGLE_CLIENT_ID         echo set "GOOGLE_CLIENT_ID=%GOOGLE_CLIENT_ID%">> "%BOOT_SCRIPT%"
if defined GOOGLE_CLIENT_SECRET     echo set "GOOGLE_CLIENT_SECRET=%GOOGLE_CLIENT_SECRET%">> "%BOOT_SCRIPT%"
if defined GOOGLE_REDIRECT_URI      echo set "GOOGLE_REDIRECT_URI=%GOOGLE_REDIRECT_URI%">> "%BOOT_SCRIPT%"
if defined APP_BOOTSTRAP_ADMIN_EMAIL    echo set "APP_BOOTSTRAP_ADMIN_EMAIL=%APP_BOOTSTRAP_ADMIN_EMAIL%">> "%BOOT_SCRIPT%"
if defined APP_BOOTSTRAP_ADMIN_PASSWORD echo set "APP_BOOTSTRAP_ADMIN_PASSWORD=%APP_BOOTSTRAP_ADMIN_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_SHARED_RUNNER_ENABLED echo set "APP_LOCAL_SHARED_RUNNER_ENABLED=%APP_LOCAL_SHARED_RUNNER_ENABLED%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_SHARED_RUNNER_EMAIL echo set "APP_LOCAL_SHARED_RUNNER_EMAIL=%APP_LOCAL_SHARED_RUNNER_EMAIL%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_SHARED_RUNNER_PASSWORD echo set "APP_LOCAL_SHARED_RUNNER_PASSWORD=%APP_LOCAL_SHARED_RUNNER_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_SHARED_RUNNER_DISPLAY_NAME echo set "APP_LOCAL_SHARED_RUNNER_DISPLAY_NAME=%APP_LOCAL_SHARED_RUNNER_DISPLAY_NAME%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_RIVAL_ENABLED echo set "APP_LOCAL_TERRITORY_RIVAL_ENABLED=%APP_LOCAL_TERRITORY_RIVAL_ENABLED%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_RIVAL_EMAIL echo set "APP_LOCAL_TERRITORY_RIVAL_EMAIL=%APP_LOCAL_TERRITORY_RIVAL_EMAIL%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_RIVAL_PASSWORD echo set "APP_LOCAL_TERRITORY_RIVAL_PASSWORD=%APP_LOCAL_TERRITORY_RIVAL_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_RIVAL_DISPLAY_NAME echo set "APP_LOCAL_TERRITORY_RIVAL_DISPLAY_NAME=%APP_LOCAL_TERRITORY_RIVAL_DISPLAY_NAME%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_FLUSHING_ENABLED echo set "APP_LOCAL_TERRITORY_FLUSHING_ENABLED=%APP_LOCAL_TERRITORY_FLUSHING_ENABLED%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_FLUSHING_EMAIL echo set "APP_LOCAL_TERRITORY_FLUSHING_EMAIL=%APP_LOCAL_TERRITORY_FLUSHING_EMAIL%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_FLUSHING_PASSWORD echo set "APP_LOCAL_TERRITORY_FLUSHING_PASSWORD=%APP_LOCAL_TERRITORY_FLUSHING_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_FLUSHING_DISPLAY_NAME echo set "APP_LOCAL_TERRITORY_FLUSHING_DISPLAY_NAME=%APP_LOCAL_TERRITORY_FLUSHING_DISPLAY_NAME%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_FLUSHING_INNER_ENABLED echo set "APP_LOCAL_TERRITORY_FLUSHING_INNER_ENABLED=%APP_LOCAL_TERRITORY_FLUSHING_INNER_ENABLED%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_FLUSHING_INNER_EMAIL echo set "APP_LOCAL_TERRITORY_FLUSHING_INNER_EMAIL=%APP_LOCAL_TERRITORY_FLUSHING_INNER_EMAIL%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_FLUSHING_INNER_PASSWORD echo set "APP_LOCAL_TERRITORY_FLUSHING_INNER_PASSWORD=%APP_LOCAL_TERRITORY_FLUSHING_INNER_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_FLUSHING_INNER_DISPLAY_NAME echo set "APP_LOCAL_TERRITORY_FLUSHING_INNER_DISPLAY_NAME=%APP_LOCAL_TERRITORY_FLUSHING_INNER_DISPLAY_NAME%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_BERLIN_ENABLED echo set "APP_LOCAL_TERRITORY_BERLIN_ENABLED=%APP_LOCAL_TERRITORY_BERLIN_ENABLED%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_BERLIN_EMAIL echo set "APP_LOCAL_TERRITORY_BERLIN_EMAIL=%APP_LOCAL_TERRITORY_BERLIN_EMAIL%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_BERLIN_PASSWORD echo set "APP_LOCAL_TERRITORY_BERLIN_PASSWORD=%APP_LOCAL_TERRITORY_BERLIN_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_LOCAL_TERRITORY_BERLIN_DISPLAY_NAME echo set "APP_LOCAL_TERRITORY_BERLIN_DISPLAY_NAME=%APP_LOCAL_TERRITORY_BERLIN_DISPLAY_NAME%">> "%BOOT_SCRIPT%"
if defined APP_JPA_DDL_AUTO         echo set "APP_JPA_DDL_AUTO=%APP_JPA_DDL_AUTO%">> "%BOOT_SCRIPT%"
if defined APP_AI_API_KEY           echo set "APP_AI_API_KEY=%APP_AI_API_KEY%">> "%BOOT_SCRIPT%"
if defined APP_AI_MODEL             echo set "APP_AI_MODEL=%APP_AI_MODEL%">> "%BOOT_SCRIPT%"
if defined APP_AI_PROVIDER          echo set "APP_AI_PROVIDER=%APP_AI_PROVIDER%">> "%BOOT_SCRIPT%"
if defined APP_AI_COURSE_MAP_PROVIDER echo set "APP_AI_COURSE_MAP_PROVIDER=%APP_AI_COURSE_MAP_PROVIDER%">> "%BOOT_SCRIPT%"
if defined APP_ROUTE_EXTRACTION_PYTHON_COMMAND echo set "APP_ROUTE_EXTRACTION_PYTHON_COMMAND=%APP_ROUTE_EXTRACTION_PYTHON_COMMAND%">> "%BOOT_SCRIPT%"
if defined APP_ROUTE_EXTRACTION_QWEN_MODEL_ID echo set "APP_ROUTE_EXTRACTION_QWEN_MODEL_ID=%APP_ROUTE_EXTRACTION_QWEN_MODEL_ID%">> "%BOOT_SCRIPT%"
if defined APP_ROUTE_EXTRACTION_QWEN_DEVICE_MAP echo set "APP_ROUTE_EXTRACTION_QWEN_DEVICE_MAP=%APP_ROUTE_EXTRACTION_QWEN_DEVICE_MAP%">> "%BOOT_SCRIPT%"
if defined APP_ROUTE_EXTRACTION_QWEN_CACHE_DIR echo set "APP_ROUTE_EXTRACTION_QWEN_CACHE_DIR=%APP_ROUTE_EXTRACTION_QWEN_CACHE_DIR%">> "%BOOT_SCRIPT%"
if defined APP_ROUTE_EXTRACTION_QWEN_ALIGNMENT_SCRIPT echo set "APP_ROUTE_EXTRACTION_QWEN_ALIGNMENT_SCRIPT=%APP_ROUTE_EXTRACTION_QWEN_ALIGNMENT_SCRIPT%">> "%BOOT_SCRIPT%"
if defined APP_ROUTE_EXTRACTION_QWEN_PARAMETERS_SCRIPT echo set "APP_ROUTE_EXTRACTION_QWEN_PARAMETERS_SCRIPT=%APP_ROUTE_EXTRACTION_QWEN_PARAMETERS_SCRIPT%">> "%BOOT_SCRIPT%"
if defined APP_ROUTE_EXTRACTION_QWEN_ANCHOR_SCRIPT echo set "APP_ROUTE_EXTRACTION_QWEN_ANCHOR_SCRIPT=%APP_ROUTE_EXTRACTION_QWEN_ANCHOR_SCRIPT%">> "%BOOT_SCRIPT%"
if defined APP_CARTO_BASEMAPS_API_KEY     echo set "APP_CARTO_BASEMAPS_API_KEY=%APP_CARTO_BASEMAPS_API_KEY%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_HOST         echo set "SPRING_MAIL_HOST=%SPRING_MAIL_HOST%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_PORT         echo set "SPRING_MAIL_PORT=%SPRING_MAIL_PORT%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_USERNAME     echo set "SPRING_MAIL_USERNAME=%SPRING_MAIL_USERNAME%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_PASSWORD     echo set "SPRING_MAIL_PASSWORD=%SPRING_MAIL_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_MAIL_FROM            echo set "APP_MAIL_FROM=%APP_MAIL_FROM%">> "%BOOT_SCRIPT%"
if defined APP_PUBLIC_BASE_URL     echo set "APP_PUBLIC_BASE_URL=%APP_PUBLIC_BASE_URL%">> "%BOOT_SCRIPT%"
if defined HERMES_ADMIN_MFA_ENABLED echo set "HERMES_ADMIN_MFA_ENABLED=%HERMES_ADMIN_MFA_ENABLED%">> "%BOOT_SCRIPT%"
if defined HERMES_WEBAUTHN_RP_ID echo set "HERMES_WEBAUTHN_RP_ID=%HERMES_WEBAUTHN_RP_ID%">> "%BOOT_SCRIPT%"
if defined HERMES_WEBAUTHN_RP_NAME echo set "HERMES_WEBAUTHN_RP_NAME=%HERMES_WEBAUTHN_RP_NAME%">> "%BOOT_SCRIPT%"
if defined HERMES_WEBAUTHN_ALLOWED_ORIGINS echo set "HERMES_WEBAUTHN_ALLOWED_ORIGINS=%HERMES_WEBAUTHN_ALLOWED_ORIGINS%">> "%BOOT_SCRIPT%"
if defined HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN echo set "HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN=%HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN%">> "%BOOT_SCRIPT%"
if defined HERMES_ADMIN_ACCESS_ENABLED echo set "HERMES_ADMIN_ACCESS_ENABLED=%HERMES_ADMIN_ACCESS_ENABLED%">> "%BOOT_SCRIPT%"
if defined HERMES_ADMIN_ACCESS_TEAM_DOMAIN echo set "HERMES_ADMIN_ACCESS_TEAM_DOMAIN=%HERMES_ADMIN_ACCESS_TEAM_DOMAIN%">> "%BOOT_SCRIPT%"
if defined HERMES_ADMIN_ACCESS_AUDIENCE echo set "HERMES_ADMIN_ACCESS_AUDIENCE=%HERMES_ADMIN_ACCESS_AUDIENCE%">> "%BOOT_SCRIPT%"
if defined HERMES_ADMIN_ACCESS_ALLOWED_EMAILS echo set "HERMES_ADMIN_ACCESS_ALLOWED_EMAILS=%HERMES_ADMIN_ACCESS_ALLOWED_EMAILS%">> "%BOOT_SCRIPT%"
if defined HERMES_ENV              echo set "HERMES_ENV=%HERMES_ENV%">> "%BOOT_SCRIPT%"
if defined SPRING_PROFILES_ACTIVE  echo set "SPRING_PROFILES_ACTIVE=%SPRING_PROFILES_ACTIVE%">> "%BOOT_SCRIPT%"
if defined APP_ENABLE_HSTS         echo set "APP_ENABLE_HSTS=%APP_ENABLE_HSTS%">> "%BOOT_SCRIPT%"
if defined APP_CORS_ALLOWED_ORIGINS echo set "APP_CORS_ALLOWED_ORIGINS=%APP_CORS_ALLOWED_ORIGINS%">> "%BOOT_SCRIPT%"
if defined STRIPE_SECRET_KEY       echo set "STRIPE_SECRET_KEY=%STRIPE_SECRET_KEY%">> "%BOOT_SCRIPT%"
if defined STRIPE_WEBHOOK_SECRET   echo set "STRIPE_WEBHOOK_SECRET=%STRIPE_WEBHOOK_SECRET%">> "%BOOT_SCRIPT%"
if defined STRIPE_PRICE_PRO_MONTHLY echo set "STRIPE_PRICE_PRO_MONTHLY=%STRIPE_PRICE_PRO_MONTHLY%">> "%BOOT_SCRIPT%"
echo cd /d "%ROOT%">> "%BOOT_SCRIPT%"
echo call .tools\run-backend.cmd>> "%BOOT_SCRIPT%"

echo [2/4] Waking up Spring Boot (Java)...
if exist "%HERMES_BACKEND_LOG%" del "%HERMES_BACKEND_LOG%" >nul 2>nul
start "Hermes - Spring Boot Server" cmd /c call "%BOOT_SCRIPT%" ^> "%HERMES_BACKEND_LOG%" 2^>^&1

:: 3. Start the Python auto-import watcher when a local virtualenv is available
if defined PYTHON_EXE (
    if exist "%SYNC_CONFIG%" (
        echo [3/4] Waking up Hermes auto-import watcher...
        start "Hermes - Auto Import Watcher" cmd /k "cd /d %ROOT% && \"%PYTHON_EXE%\" .tools\hermes_auto_sync.py \"%SYNC_CONFIG%\""
    ) else (
        echo [3/4] Auto-import watcher not started.
        echo       To enable: copy .tools\hermes_sync_config.example.json to .tools\hermes_sync_config.json
        echo       then set auth email/password and import folders. See README "Garmin / COROS Auto-Import".
    )
) else (
    echo [3/4] Skipping auto-import watcher. No local virtualenv was found.
    echo       To enable: py -3.12 -m venv .venv
)

:: 4. Wait until Spring Boot serves the site before opening the browser
goto :wait_for_backend

:retry_backend
echo [2/4] Waking up Spring Boot (Java)...
if exist "%HERMES_BACKEND_LOG%" del "%HERMES_BACKEND_LOG%" >nul 2>nul
start "Hermes - Spring Boot Server" cmd /c call "%BOOT_SCRIPT%" ^> "%HERMES_BACKEND_LOG%" 2^>^&1
:wait_for_backend
echo [4/4] Waiting for Spring Boot on localhost:8080...
:: Reset the per-run probe log so it only reflects this attempt.
if exist "%ROOT%\backend_probe.log" del "%ROOT%\backend_probe.log" >nul 2>nul
:: Gate uses a TCP connect as the PRIMARY "is the server up" signal, because
:: that is exactly what Spring's "Tomcat started on port 8080" log line means.
:: HTTP probing alone was unreliable here: Invoke-WebRequest can fail 100% of
:: the time inside this detached launcher window even when the server is live
:: and serving 200 to every other client (observed on Windows). A TcpClient
:: connect to 127.0.0.1:8080 depends only on the OS socket layer, so it does
:: not share that failure mode. We still issue one HTTP request per iteration
:: and write any exception to the probe log so future failures are diagnosable.
for /l %%I in (1,1,120) do (
    powershell -NoProfile -Command ^
        "$ok = $false; $err = ''; try { $c = New-Object Net.Sockets.TcpClient; $iar = $c.BeginConnect('127.0.0.1', 8080, $null, $null); if ($iar.AsyncWaitHandle.WaitOne(1500)) { $c.EndConnect($iar); $ok = $c.Connected } else { $err = 'tcp-timeout' } } catch { $err = 'tcp:' + $_.Exception.Message }; if ($c) { try { $c.Close() } catch {} }; if ($ok) { $httpOk = $false; try { $r = Invoke-WebRequest -Uri '%HEALTH_URL%' -UseBasicParsing -TimeoutSec 4 -MaximumRedirection 0; $httpOk = ($r.StatusCode -lt 500); if (-not $httpOk) { $err = 'http-' + $r.StatusCode } } catch { $err = 'http:' + $_.Exception.Message }; if ($httpOk) { exit 0 } else { Add-Content -Path '%ROOT%\backend_probe.log' -Value ('tcp-up-but-' + $err) -ErrorAction SilentlyContinue; exit 0 } } else { Add-Content -Path '%ROOT%\backend_probe.log' -Value ($err) -ErrorAction SilentlyContinue; exit 1 }"
    if not errorlevel 1 goto :open_app
    if exist "%HERMES_BACKEND_LOG%" (
        findstr /C:"Application run failed" /C:"BUILD FAILURE" /C:"DataIntegrityViolationException" "%HERMES_BACKEND_LOG%" >nul 2>nul
        if not errorlevel 1 (
            echo.
            echo [Hermes] Spring Boot exited before binding localhost:8080.
            echo [Hermes] Backend failure details:
            powershell -NoProfile -Command ^
                "Get-Content '%HERMES_BACKEND_LOG%' -Tail 25 | Where-Object { $_ -match 'ERROR|Caused by|Exception|BUILD FAILURE|Application run failed' } | Select-Object -Last 15"
            goto :startup_failed
        )
    )
    powershell -NoProfile -Command "[Console]::Write('.')"
    timeout /t 1 /nobreak > nul
)
echo.

if not defined BACKEND_RETRY_DONE (
    findstr /C:"NoClassDefFoundError: com/hermes/backend/" /C:"ClassNotFoundException: com.hermes.backend." "%HERMES_BACKEND_LOG%" >nul 2>nul
    if not errorlevel 1 (
        echo [Hermes] Spring Boot hit a stale backend class error. Retrying once...
        set "BACKEND_RETRY_DONE=1"
        timeout /t 2 /nobreak > nul
        goto :retry_backend
    )
)

echo [Warn] Spring Boot did not answer on localhost:8080 within 120 seconds.
echo [Warn] If it is still starting, open %APP_URL% manually once it is ready.
echo [Hermes] Probe errors captured this run ^(backend_probe.log, last 15^):
powershell -NoProfile -Command ^
    "if (Test-Path '%ROOT%\backend_probe.log') { Get-Content '%ROOT%\backend_probe.log' -Tail 15 } else { Write-Host '(no probe log written)' }"
echo [Hermes] Most recent backend log lines ^(from %HERMES_BACKEND_LOG%^):
powershell -NoProfile -Command ^
    "if (Test-Path '%HERMES_BACKEND_LOG%') { Get-Content '%HERMES_BACKEND_LOG%' -Tail 25 | Where-Object { $_ -match 'ERROR|WARN|Caused by|Started BackendApplication|Tomcat started|APPLICATION FAILED|Dialect|Unable to|Exception' } | Select-Object -Last 15 }"
goto :startup_failed

:open_app
:: ---- Runtime origin marker ----------------------------------------------------
:: Record which tree + PID is actually serving :8080 right now, so stop_hermes
:: and the other tree's start guard always know the serving origin. The listener
:: is re-verified to originate from THIS tree before writing, so a lost start
:: race (another tree's backend answering our health probe) can never attribute
:: the other tree's backend to this tree in the marker.
powershell -NoProfile -Command ^
    "$dir = Join-Path $env:USERPROFILE '.hermes';" ^
    "if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null };" ^
    "$markerPath = Join-Path $dir 'runtime.json';" ^
    "$thisRoot = '%ROOT%'.TrimEnd('\');" ^
    "$row = netstat -ano | Select-String ':8080\s+.*LISTENING' | Select-Object -First 1;" ^
    "$procId = if ($row) { ($row -replace '.*\s', '').Trim() };" ^
    "if ($procId -notmatch '^\d+$') { Write-Host '[Hermes] WARN: nothing is LISTENING on :8080; runtime marker not written.' } else {" ^
    "  $origin = $null;" ^
    "  $proc = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $procId);" ^
    "  if (Test-Path $markerPath) { try { $m = Get-Content $markerPath -Raw | ConvertFrom-Json; if ($m.projectRoot -and ([string]$m.pid) -eq ([string]$procId) -and $proc -and $proc.Name -eq 'java.exe' -and $proc.CommandLine -match 'BackendApplication') { $origin = ([string]$m.projectRoot).TrimEnd('\') } } catch { } };" ^
    "  if (-not $origin -and $proc -and $proc.Name -eq 'java.exe' -and $proc.CommandLine -match 'BackendApplication') {" ^
    "    if ($proc.CommandLine -match '@(\S+\.argfile)') {" ^
    "      $argfile = $Matches[1];" ^
    "      if (Test-Path $argfile) {" ^
    "        $cp = (Get-Content $argfile -TotalCount 1).Trim().Trim([char]34).Replace('\\', '\');" ^
    "        $entry = $cp.Split(';')[0];" ^
    "        if ($entry -match '^(.+?)\\backend\\target\\classes$') { $origin = $Matches[1] }" ^
    "      }" ^
    "    };" ^
    "    if (-not $origin) { foreach ($piece in ($proc.CommandLine -split '[ ;]')) { $t = $piece.Trim().Trim([char]34); if ($t -match '^([A-Za-z]:\\.*?)\\backend\\target\\classes') { $origin = $Matches[1]; break } } }" ^
    "  };" ^
    "  if ($origin -and $origin -eq $thisRoot) {" ^
    "    $payload = @{ projectRoot = $thisRoot; pid = [int]$procId; port = 8080; startedAt = (Get-Date).ToString('o') };" ^
    "    [IO.File]::WriteAllText($markerPath, (ConvertTo-Json $payload -Compress), (New-Object Text.UTF8Encoding $false));" ^
    "    Write-Host ('[Hermes] Runtime origin marker written: ' + $markerPath + ' (pid ' + $procId + ')')" ^
    "  } else { Write-Host '[Hermes] WARN: backend on :8080 did not originate from this tree - marker not written.' }" ^
    "}"
echo Launching Hermes...
start "" "%APP_URL%"
echo ==========================================
echo Hermes is online!
echo To stop everything ^(backend, auto-import watcher, leftover background processes^), run stop_hermes.cmd
echo ==========================================
if not defined HERMES_NO_PAUSE pause
exit /b 0

:startup_failed
echo ==========================================
echo Hermes did not finish starting.
echo ==========================================
if not defined HERMES_NO_PAUSE pause
