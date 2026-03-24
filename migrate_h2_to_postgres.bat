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

set "CP=C:\Users\mcpej.JUNWEI.000\.m2\repository\com\h2database\h2\2.4.240\h2-2.4.240.jar;C:\Users\mcpej.JUNWEI.000\.m2\repository\org\postgresql\postgresql\42.7.5\postgresql-42.7.5.jar;."

echo Migrating Hermes data from H2 to PostgreSQL...
java --class-path "%CP%" .tools\H2ToPostgresMigrator.java "%H2_URL%" "%APP_DB_URL%" "%APP_DB_USERNAME%" "%APP_DB_PASSWORD%" --truncate

if errorlevel 1 (
  echo Migration failed.
  exit /b 1
)

echo Migration finished.
endlocal
