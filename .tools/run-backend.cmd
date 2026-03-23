@echo off

echo [Hermes] Hunting for JDK 17 and Maven...

:: Find the root directory (one folder up from where this script lives)
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "MAVEN_REPO=%USERPROFILE%\.m2\repository"
set "MVN_CMD="
set "JAVA_HOME="
set "CHECK_ONLY="

if /i "%~1"=="--check-only" (
  set "CHECK_ONLY=1"
)

:: Look for a bundled JDK 17 in .tools\jdk17\
for /d %%D in ("%ROOT%\.tools\jdk17\jdk-*") do (
  if exist "%%~fD\bin\java.exe" (
    set "JAVA_HOME=%%~fD"
    goto :jdk_found
  )
)

:: Fall back to common machine-wide JDK installs
for /d %%D in ("%ProgramFiles%\Java\jdk-*") do (
  if exist "%%~fD\bin\java.exe" (
    set "JAVA_HOME=%%~fD"
    goto :jdk_found
  )
)

for /d %%D in ("%ProgramFiles%\Eclipse Adoptium\jdk-*") do (
  if exist "%%~fD\bin\java.exe" (
    set "JAVA_HOME=%%~fD"
    goto :jdk_found
  )
)

for /d %%D in ("%ProgramFiles%\Microsoft\jdk-*") do (
  if exist "%%~fD\bin\java.exe" (
    set "JAVA_HOME=%%~fD"
    goto :jdk_found
  )
)

:: JetBrains IDEs often ship a bundled Java 17 runtime we can reuse locally.
for /d %%D in ("%ProgramFiles%\JetBrains\*") do (
  if exist "%%~fD\jbr\bin\java.exe" (
    set "JAVA_HOME=%%~fD\jbr"
    goto :jdk_found
  )
  if exist "%%~fD\jbrsdk\bin\java.exe" (
    set "JAVA_HOME=%%~fD\jbrsdk"
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

if not "%JAVA_MAJOR%"=="17" (
  echo [Hermes] Java %JAVA_VERSION% was found, but Hermes requires Java 17.
  echo [Hermes] Install Java 17 or place a JDK under .tools\jdk17 before starting Hermes.
  exit /b 1
)

if defined CHECK_ONLY (
  exit /b 0
)

:: Look for a Maven installation downloaded by the Maven wrapper
for /d %%D in ("%USERPROFILE%\.m2\wrapper\dists\apache-maven-*\*") do (
  if exist "%%~fD\bin\mvn.cmd" (
    set "MVN_CMD=%%~fD\bin\mvn.cmd"
    goto :mvn_found
  )
)

:mvn_found
:: Move into the backend folder to launch
cd /d "%ROOT%\backend"

echo [Hermes] Igniting Spring Boot...
if defined MVN_CMD (
  call "%MVN_CMD%" -Dmaven.repo.local="%MAVEN_REPO%" spring-boot:run
) else (
  call mvnw.cmd -Dmaven.repo.local="%MAVEN_REPO%" spring-boot:run
)

exit /b %ERRORLEVEL%
