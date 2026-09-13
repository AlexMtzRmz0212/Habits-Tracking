@echo off
REM Habits-Tracking Dev Server Launcher
REM Wrapper that calls the PowerShell script

echo.
echo Starting dev script...
echo.

REM Call the PowerShell script
powershell -NoProfile -ExecutionPolicy RemoteSigned -File "dev.ps1"

echo.
echo Back in root directory.
echo.
