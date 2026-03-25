@echo off

echo ==========================================
echo       STARTING HERMES TECH STACK
echo ==========================================

set "ROOT=%~dp0"
set "APP_URL=http://localhost:8080"
set "HEALTH_URL=http://localhost:8080"
set "PYTHON_EXE="
set "SYNC_CONFIG=%ROOT%.tools\hermes_sync_config.json"
set "BOOT_SCRIPT=%TEMP%\hermes_boot_%RANDOM%.cmd"

if exist "%ROOT%.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%ROOT%.venv\Scripts\python.exe"
) else if exist "%ROOT%backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%ROOT%backend\venv\Scripts\python.exe"
)

powershell -NoProfile -Command ^
    "try { $r = Invoke-WebRequest -Uri '%HEALTH_URL%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 (
    echo [Hermes] Stopping old backend on localhost:8080...
    powershell -NoProfile -Command "Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force"
    timeout /t 2 /nobreak > nul
)

:: 1. Check backend requirements before opening any windows
echo [1/4] Checking Spring Boot requirements...
call .tools\run-backend.cmd --check-only
if errorlevel 1 goto :startup_failed

:: 2. Build a temp boot script that carries all env vars into the new window
echo @echo off > "%BOOT_SCRIPT%"
if defined APP_DB_URL               echo set "APP_DB_URL=%APP_DB_URL%">> "%BOOT_SCRIPT%"
if defined APP_DB_DRIVER            echo set "APP_DB_DRIVER=%APP_DB_DRIVER%">> "%BOOT_SCRIPT%"
if defined APP_DB_USERNAME          echo set "APP_DB_USERNAME=%APP_DB_USERNAME%">> "%BOOT_SCRIPT%"
if defined APP_DB_PASSWORD          echo set "APP_DB_PASSWORD=%APP_DB_PASSWORD%">> "%BOOT_SCRIPT%"
if defined STRAVA_CLIENT_ID         echo set "STRAVA_CLIENT_ID=%STRAVA_CLIENT_ID%">> "%BOOT_SCRIPT%"
if defined STRAVA_CLIENT_SECRET     echo set "STRAVA_CLIENT_SECRET=%STRAVA_CLIENT_SECRET%">> "%BOOT_SCRIPT%"
if defined STRAVA_REDIRECT_URI      echo set "STRAVA_REDIRECT_URI=%STRAVA_REDIRECT_URI%">> "%BOOT_SCRIPT%"
if defined APP_DATA_ENCRYPTION_KEY  echo set "APP_DATA_ENCRYPTION_KEY=%APP_DATA_ENCRYPTION_KEY%">> "%BOOT_SCRIPT%"
if defined APP_GOOGLE_CLIENT_ID     echo set "APP_GOOGLE_CLIENT_ID=%APP_GOOGLE_CLIENT_ID%">> "%BOOT_SCRIPT%"
if defined APP_GOOGLE_CLIENT_SECRET echo set "APP_GOOGLE_CLIENT_SECRET=%APP_GOOGLE_CLIENT_SECRET%">> "%BOOT_SCRIPT%"
if defined APP_GOOGLE_REDIRECT_URI  echo set "APP_GOOGLE_REDIRECT_URI=%APP_GOOGLE_REDIRECT_URI%">> "%BOOT_SCRIPT%"
if defined APP_BOOTSTRAP_ADMIN_EMAIL    echo set "APP_BOOTSTRAP_ADMIN_EMAIL=%APP_BOOTSTRAP_ADMIN_EMAIL%">> "%BOOT_SCRIPT%"
if defined APP_BOOTSTRAP_ADMIN_PASSWORD echo set "APP_BOOTSTRAP_ADMIN_PASSWORD=%APP_BOOTSTRAP_ADMIN_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_JPA_DDL_AUTO         echo set "APP_JPA_DDL_AUTO=%APP_JPA_DDL_AUTO%">> "%BOOT_SCRIPT%"
if defined APP_AI_API_KEY           echo set "APP_AI_API_KEY=%APP_AI_API_KEY%">> "%BOOT_SCRIPT%"
if defined APP_AI_MODEL             echo set "APP_AI_MODEL=%APP_AI_MODEL%">> "%BOOT_SCRIPT%"
if defined APP_AI_PROVIDER          echo set "APP_AI_PROVIDER=%APP_AI_PROVIDER%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_HOST         echo set "SPRING_MAIL_HOST=%SPRING_MAIL_HOST%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_PORT         echo set "SPRING_MAIL_PORT=%SPRING_MAIL_PORT%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_USERNAME     echo set "SPRING_MAIL_USERNAME=%SPRING_MAIL_USERNAME%">> "%BOOT_SCRIPT%"
if defined SPRING_MAIL_PASSWORD     echo set "SPRING_MAIL_PASSWORD=%SPRING_MAIL_PASSWORD%">> "%BOOT_SCRIPT%"
if defined APP_MAIL_FROM            echo set "APP_MAIL_FROM=%APP_MAIL_FROM%">> "%BOOT_SCRIPT%"
if defined APP_PUBLIC_BASE_URL     echo set "APP_PUBLIC_BASE_URL=%APP_PUBLIC_BASE_URL%">> "%BOOT_SCRIPT%"
echo cd /d "%ROOT%">> "%BOOT_SCRIPT%"
echo call .tools\run-backend.cmd>> "%BOOT_SCRIPT%"

echo [2/4] Waking up Spring Boot (Java)...
start "Hermes - Spring Boot Server" cmd /k "%BOOT_SCRIPT%"

:: 3. Start the Python Analytics Engine when Python is available
if defined PYTHON_EXE (
    echo [3/4] Waking up Python VDOT Engine...
    start "Hermes - Python Engine" cmd /k "cd /d %ROOT% && \"%PYTHON_EXE%\" backend\src\main\resources\static\vdot_engine.py"

    if exist "%SYNC_CONFIG%" (
        echo [3/4] Waking up Hermes auto-import watcher...
        start "Hermes - Auto Import Watcher" cmd /k "cd /d %ROOT% && \"%PYTHON_EXE%\" .tools\hermes_auto_sync.py \"%SYNC_CONFIG%\""
    ) else (
        echo [3/4] Auto-import watcher not started. Create .tools\hermes_sync_config.json to enable it.
    )
) else (
    echo [3/4] Skipping Python VDOT Engine. No local virtualenv was found.
    echo [3/4] Skipping auto-import watcher because Python is unavailable.
)

:: 4. Wait until Spring Boot serves the site before opening the browser
echo [4/4] Waiting for Spring Boot on localhost:8080...
for /l %%I in (1,1,30) do (
    powershell -NoProfile -Command ^
        "try { $r = Invoke-WebRequest -Uri '%HEALTH_URL%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
    if not errorlevel 1 (
        goto :open_app
    )
    timeout /t 1 /nobreak > nul
)

echo [Warn] Spring Boot did not answer on localhost:8080 within 30 seconds.
echo [Warn] Keep the backend window open and check for startup errors.
echo [Warn] Once it is ready, open %APP_URL% manually.
goto :startup_failed

:open_app
echo Launching Hermes...
start "" "%APP_URL%"
echo ==========================================
echo Hermes is online!
echo ==========================================
pause
exit /b 0

:startup_failed
echo ==========================================
echo Hermes did not finish starting.
echo ==========================================
pause
