@echo off
setlocal

set "H2_URL=%APP_H2_URL%"
if "%H2_URL%"=="" set "H2_URL=jdbc:h2:file:./backend/hermes_db_v2;AUTO_SERVER=TRUE"

if "%APP_DB_URL%"=="" (
  echo APP_DB_URL is not set.
  echo Example: set APP_DB_URL=jdbc:postgresql://localhost:5432/hermes
  exit /b 1
)

if "%APP_DB_USERNAME%"=="" (
  echo APP_DB_USERNAME is not set.
  exit /b 1
)

set "M2=%USERPROFILE%\.m2\repository"
set "H2_JAR="
set "PG_JAR="
for /f "delims=" %%I in ('dir /b /s "%M2%\com\h2database\h2\h2-*.jar" 2^>nul') do if not defined H2_JAR set "H2_JAR=%%I"
for /f "delims=" %%I in ('dir /b /s "%M2%\org\postgresql\postgresql\postgresql-*.jar" 2^>nul') do if not defined PG_JAR set "PG_JAR=%%I"

if "%H2_JAR%"=="" (
  echo Could not find the H2 JDBC driver under %M2%.
  exit /b 1
)

if "%PG_JAR%"=="" (
  echo Could not find the PostgreSQL JDBC driver under %M2%.
  exit /b 1
)

set "CP=%H2_JAR%;%PG_JAR%;."

echo Migrating Hermes data from H2 to PostgreSQL...
java --class-path "%CP%" .tools\H2ToPostgresMigrator.java "%H2_URL%" "%APP_DB_URL%" "%APP_DB_USERNAME%" "%APP_DB_PASSWORD%" --truncate

if errorlevel 1 (
  echo Migration failed.
  exit /b 1
)

echo Migration finished.
endlocal
