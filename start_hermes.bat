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
        "$vars = @('APP_DB_URL','APP_DB_DRIVER','APP_DB_USERNAME','APP_DB_PASSWORD','STRAVA_CLIENT_ID','STRAVA_CLIENT_SECRET','STRAVA_REDIRECT_URI','APP_STRAVA_CLIENT_ID','APP_STRAVA_CLIENT_SECRET','APP_STRAVA_REDIRECT_URI','APP_DATA_ENCRYPTION_KEY','APP_GOOGLE_CLIENT_ID','APP_GOOGLE_CLIENT_SECRET','APP_GOOGLE_REDIRECT_URI','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','APP_BOOTSTRAP_ADMIN_EMAIL','APP_BOOTSTRAP_ADMIN_PASSWORD','APP_LOCAL_SHARED_RUNNER_ENABLED','APP_LOCAL_SHARED_RUNNER_EMAIL','APP_LOCAL_SHARED_RUNNER_PASSWORD','APP_LOCAL_SHARED_RUNNER_DISPLAY_NAME','APP_LOCAL_TERRITORY_RIVAL_ENABLED','APP_LOCAL_TERRITORY_RIVAL_EMAIL','APP_LOCAL_TERRITORY_RIVAL_PASSWORD','APP_LOCAL_TERRITORY_RIVAL_DISPLAY_NAME','APP_LOCAL_TERRITORY_FLUSHING_ENABLED','APP_LOCAL_TERRITORY_FLUSHING_EMAIL','APP_LOCAL_TERRITORY_FLUSHING_PASSWORD','APP_LOCAL_TERRITORY_FLUSHING_DISPLAY_NAME','APP_LOCAL_TERRITORY_FLUSHING_INNER_ENABLED','APP_LOCAL_TERRITORY_FLUSHING_INNER_EMAIL','APP_LOCAL_TERRITORY_FLUSHING_INNER_PASSWORD','APP_LOCAL_TERRITORY_FLUSHING_INNER_DISPLAY_NAME','APP_LOCAL_TERRITORY_BERLIN_ENABLED','APP_LOCAL_TERRITORY_BERLIN_EMAIL','APP_LOCAL_TERRITORY_BERLIN_PASSWORD','APP_LOCAL_TERRITORY_BERLIN_DISPLAY_NAME','APP_JPA_DDL_AUTO','APP_AI_API_KEY','APP_AI_MODEL','APP_AI_PROVIDER','APP_AI_COURSE_MAP_PROVIDER','APP_ROUTE_EXTRACTION_PYTHON_COMMAND','APP_ROUTE_EXTRACTION_QWEN_MODEL_ID','APP_ROUTE_EXTRACTION_QWEN_DEVICE_MAP','APP_ROUTE_EXTRACTION_QWEN_CACHE_DIR','APP_ROUTE_EXTRACTION_QWEN_ALIGNMENT_SCRIPT','APP_ROUTE_EXTRACTION_QWEN_PARAMETERS_SCRIPT','APP_ROUTE_EXTRACTION_QWEN_ANCHOR_SCRIPT','SPRING_MAIL_HOST','SPRING_MAIL_PORT','SPRING_MAIL_USERNAME','SPRING_MAIL_PASSWORD','APP_MAIL_FROM','APP_PUBLIC_BASE_URL','HERMES_ENV','SPRING_PROFILES_ACTIVE','APP_ENABLE_HSTS','APP_CORS_ALLOWED_ORIGINS','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_PRO_MONTHLY');" ^
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
if defined SPRING_MAIL_HOST         echo set "SPRING_MAIL_HOST=%SPRING_MAIL_HOST%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_PORT         echo set "SPRING_MAIL_PORT=%SPRING_MAIL_PORT%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_USERNAME     echo set "SPRING_MAIL_USERNAME=%SPRING_MAIL_USERNAME%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_PASSWORD     echo set "SPRING_MAIL_PASSWORD=%SPRING_MAIL_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_MAIL_FROM            echo set "APP_MAIL_FROM=%APP_MAIL_FROM%">> "%BOOT_SCRIPT%"
if defined APP_PUBLIC_BASE_URL     echo set "APP_PUBLIC_BASE_URL=%APP_PUBLIC_BASE_URL%">> "%BOOT_SCRIPT%"
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
start "Hermes - Spring Boot Server" cmd /c call "%BOOT_SCRIPT%" ^> "%HERMES_BACKEND_LOG%" 2^>^&1

:: 3. Start the Python Analytics Engine when Python is available
if defined PYTHON_EXE (
    echo [3/4] Waking up Python VDOT Engine...
    start "Hermes - Python Engine" cmd /k "cd /d %ROOT% && \"%PYTHON_EXE%\" backend\src\main\resources\static\vdot_engine.py"

    if exist "%SYNC_CONFIG%" (
        echo [3/4] Waking up Hermes auto-import watcher...
        start "Hermes - Auto Import Watcher" cmd /k "cd /d %ROOT% && \"%PYTHON_EXE%\" .tools\hermes_auto_sync.py \"%SYNC_CONFIG%\""
    ) else (
        echo [3/4] Auto-import watcher not started.
        echo       To enable: copy .tools\hermes_sync_config.example.json to .tools\hermes_sync_config.json
        echo       then set auth email/password and import folders. See README "Garmin / COROS Auto-Import".
    )
) else (
    echo [3/4] Skipping Python VDOT Engine. No local virtualenv was found.
    echo [3/4] Skipping auto-import watcher because Python is unavailable.
)

:: 4. Wait until Spring Boot serves the site before opening the browser
goto :wait_for_backend

:retry_backend
echo [2/4] Waking up Spring Boot (Java)...
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
echo Launching Hermes...
start "" "%APP_URL%"
echo ==========================================
echo Hermes is online!
echo To stop everything ^(backend, Python engines, leftover background processes^), run stop_hermes.cmd
echo ==========================================
pause
exit /b 0

:startup_failed
echo ==========================================
echo Hermes did not finish starting.
echo ==========================================
pause
