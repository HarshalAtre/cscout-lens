@echo off
echo ============================================================
echo Running CScout-Lens Master Setup
echo ============================================================
echo.
cd /d %~dp0
node master-setup.js
if errorlevel 1 (
    echo.
    echo Node.js approach failed, trying Python...
    python setup_files.py
)
echo.
echo Setup complete! Press any key to close...
pause > nul
