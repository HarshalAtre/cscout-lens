@echo off
cd /d D:\Gsoc\C-scout\cscout\cscout-lens
echo Running create-dirs.js...
node create-dirs.js
if errorlevel 1 (
    echo create-dirs.js failed
    exit /b 1
)
echo.
echo Running master-setup.js...
node master-setup.js
if errorlevel 1 (
    echo master-setup.js failed
    exit /b 1
)
echo.
echo Setup completed successfully
