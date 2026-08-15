@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop_hermes.ps1" %*
