@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)
start "DreamAPI Starter Kit" cmd /k node server.mjs
timeout /t 2 >nul
start "" "http://127.0.0.1:8788/"
