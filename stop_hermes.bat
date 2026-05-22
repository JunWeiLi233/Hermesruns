@echo off
echo ==========================================
echo       SHUTTING DOWN HERMES STACK
echo ==========================================

echo Stopping Java (Spring Boot)...
taskkill /FI "WINDOWTITLE eq Hermes - Spring Boot Server*" /T /F >nul 2>&1
taskkill /IM java.exe /F >nul 2>&1

echo Stopping Python (VDOT Engine)...
taskkill /FI "WINDOWTITLE eq Hermes - Python Engine*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Hermes - Auto Import Watcher*" /T /F >nul 2>&1
taskkill /IM python.exe /F >nul 2>&1

echo ==========================================
echo All Hermes systems are offline.
echo ==========================================
pause
