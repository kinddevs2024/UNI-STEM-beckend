@echo off
REM MongoDB Startup Script (Batch file for easy double-click)
echo Starting MongoDB...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-mongodb.ps1"
pause

