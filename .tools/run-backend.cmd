@echo off

echo [Hermes] Hunting for JDK 17 and Maven...

:: Find the root directory (one folder up from where this script lives)
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "MAVEN_REPO=%ROOT%\.m2repo"
set "MVN_CMD="
set "JAVA_HOME="
set "CHECK_ONLY="
set "LOCAL_ENV_PS1=%ROOT%\Hermes.local.env.ps1"
set "LOCAL_ENV_BOOT=%TEMP%\hermes_run_backend_env_%RANDOM%.cmd"

if /i "%~1"=="--check-only" (
  set "CHECK_ONLY=1"
)

if exist "%LOCAL_ENV_PS1%" (
  echo [Hermes] Loading local env from Hermes.local.env.ps1...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference = 'Stop';" ^
    "$envPath = [IO.Path]::GetFullPath('%LOCAL_ENV_PS1%');" ^
    "$bootPath = [IO.Path]::GetFullPath('%LOCAL_ENV_BOOT%');" ^
    "$vars = @('APP_DB_URL','APP_DB_DRIVER','APP_DB_USERNAME','APP_DB_PASSWORD','STRAVA_CLIENT_ID','STRAVA_CLIENT_SECRET','STRAVA_REDIRECT_URI','APP_STRAVA_CLIENT_ID','APP_STRAVA_CLIENT_SECRET','APP_STRAVA_REDIRECT_URI','APP_DATA_ENCRYPTION_KEY','APP_GOOGLE_CLIENT_ID','APP_GOOGLE_CLIENT_SECRET','APP_GOOGLE_REDIRECT_URI','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','APP_BOOTSTRAP_ADMIN_EMAIL','APP_BOOTSTRAP_ADMIN_PASSWORD','APP_JPA_DDL_AUTO','APP_AI_API_KEY','APP_AI_MODEL','APP_AI_PROVIDER','APP_AI_COURSE_MAP_PROVIDER','APP_ROUTE_EXTRACTION_PYTHON_COMMAND','APP_ROUTE_EXTRACTION_QWEN_MODEL_ID','APP_ROUTE_EXTRACTION_QWEN_DEVICE_MAP','APP_ROUTE_EXTRACTION_QWEN_CACHE_DIR','APP_ROUTE_EXTRACTION_QWEN_ALIGNMENT_SCRIPT','APP_ROUTE_EXTRACTION_QWEN_PARAMETERS_SCRIPT','APP_ROUTE_EXTRACTION_QWEN_ANCHOR_SCRIPT','SPRING_MAIL_HOST','SPRING_MAIL_PORT','SPRING_MAIL_USERNAME','SPRING_MAIL_PASSWORD','APP_MAIL_FROM','APP_PUBLIC_BASE_URL','HERMES_ENV','SPRING_PROFILES_ACTIVE','APP_ENABLE_HSTS','APP_CORS_ALLOWED_ORIGINS','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_PRO_MONTHLY');" ^
    ". $envPath;" ^
    "$lines = @(foreach ($name in $vars) { $value = [Environment]::GetEnvironmentVariable($name, 'Process'); if (-not [string]::IsNullOrWhiteSpace($value)) { 'set ""' + $name + '=' + ($value -replace '%%', '%%%%') + '""' } });" ^
    "[IO.File]::WriteAllLines($bootPath, $lines, [Text.Encoding]::ASCII)"
  if errorlevel 1 (
    echo [Hermes] Failed to load local env from Hermes.local.env.ps1.
    del "%LOCAL_ENV_BOOT%" >nul 2>nul
    exit /b 1
  )
  call "%LOCAL_ENV_BOOT%"
  del "%LOCAL_ENV_BOOT%" >nul 2>nul
)

:: If java is already on PATH, use it directly
where java >nul 2>nul
if not errorlevel 1 goto :jdk_found

:: Look for a bundled JDK 17 in .tools\jdk17\
:: (no spaces in this path, so for /d wildcard works fine)
for /d %%D in ("%ROOT%\.tools\jdk17\jdk-*") do (
  if exist "%%~fD\bin\java.exe" (
    set "JAVA_HOME=%%~fD"
    goto :jdk_found
  )
)

:: Fall back to common machine-wide JDK installs.
:: for /d does NOT expand wildcards inside quoted paths (a CMD limitation),
:: so we use "dir /b /ad" to enumerate subdirs and build the path ourselves.

for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\Java" 2^>nul') do (
  if exist "%ProgramFiles%\Java\%%D\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\Java\%%D"
    goto :jdk_found
  )
)

for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\Eclipse Adoptium" 2^>nul') do (
  if exist "%ProgramFiles%\Eclipse Adoptium\%%D\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\Eclipse Adoptium\%%D"
    goto :jdk_found
  )
)

for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\Microsoft" 2^>nul') do (
  if exist "%ProgramFiles%\Microsoft\%%D\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\Microsoft\%%D"
    goto :jdk_found
  )
)

:: JetBrains IDEs often ship a bundled Java 17 runtime we can reuse locally.
for /f "delims=" %%D in ('dir /b /ad "%ProgramFiles%\JetBrains" 2^>nul') do (
  if exist "%ProgramFiles%\JetBrains\%%D\jbr\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\JetBrains\%%D\jbr"
    goto :jdk_found
  )
  if exist "%ProgramFiles%\JetBrains\%%D\jbrsdk\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\JetBrains\%%D\jbrsdk"
    goto :jdk_found
  )
)

:jdk_found
if defined JAVA_HOME (
  echo [Hermes] JDK 17 locked in.
  set "PATH=%JAVA_HOME%\bin;%PATH%"
)

where java >nul 2>nul
if errorlevel 1 (
  echo [Hermes] Java 17 was not found.
  echo [Hermes] Install Java 17 or place a JDK under .tools\jdk17 before starting Hermes.
  exit /b 1
)

set "JAVA_VERSION="
set "JAVA_MAJOR="
for /f "tokens=3" %%V in ('java -version 2^>^&1 ^| findstr /i "version"') do (
  set "JAVA_VERSION=%%~V"
  goto :java_version_found
)

:java_version_found
if not defined JAVA_VERSION (
  echo [Hermes] Could not determine the installed Java version.
  echo [Hermes] Install Java 17 or place a JDK under .tools\jdk17 before starting Hermes.
  exit /b 1
)

for /f "tokens=1,2 delims=." %%A in ("%JAVA_VERSION%") do (
  if "%%A"=="1" (
    set "JAVA_MAJOR=%%B"
  ) else (
    set "JAVA_MAJOR=%%A"
  )
)

if %JAVA_MAJOR% LSS 17 (
  echo [Hermes] Java %JAVA_VERSION% was found, but Hermes requires Java 17 or later.
  echo [Hermes] Install Java 17, 21, or place a JDK under .tools\jdk17 before starting Hermes.
  exit /b 1
)

if defined CHECK_ONLY (
  exit /b 0
)

:: Look for a Maven installation downloaded by the Maven wrapper.
:: Note: for /d does not expand double wildcards (e.g. path\*\*), so we
:: enumerate two levels explicitly with dir /b /ad.
for /f "delims=" %%V in ('dir /b /ad "%USERPROFILE%\.m2\wrapper\dists" 2^>nul ^| findstr /i "^apache-maven-"') do (
  for /f "delims=" %%H in ('dir /b /ad "%USERPROFILE%\.m2\wrapper\dists\%%V" 2^>nul') do (
    if exist "%USERPROFILE%\.m2\wrapper\dists\%%V\%%H\bin\mvn.cmd" (
      set "MVN_CMD=%USERPROFILE%\.m2\wrapper\dists\%%V\%%H\bin\mvn.cmd"
      goto :mvn_found
    )
  )
)

:mvn_found
:: Move into the backend folder to launch
cd /d "%ROOT%\backend"

echo [Hermes] Igniting Spring Boot...
:: Memory-optimized JVM flags for small servers (2GB RAM)
if not defined JAVA_TOOL_OPTIONS (
  set "JAVA_TOOL_OPTIONS=-Xmx768m -Xms256m -XX:+UseSerialGC -XX:MaxMetaspaceSize=192m"
)
if defined MVN_CMD (
  call "%MVN_CMD%" -Dmaven.repo.local="%MAVEN_REPO%" -Dmaven.test.skip=true org.springframework.boot:spring-boot-maven-plugin:run
) else (
  call "%ROOT%\backend\mvnw.cmd" -Dmaven.repo.local="%MAVEN_REPO%" -Dmaven.test.skip=true org.springframework.boot:spring-boot-maven-plugin:run
)

exit /b %ERRORLEVEL%
