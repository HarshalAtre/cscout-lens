@echo off
echo Creating directories...
cd /d "D:\Gsoc\C-scout\cscout\cscout-lens"
mkdir sample\calc 2>nul
mkdir src\db 2>nul
mkdir src\scripts 2>nul
mkdir src\services 2>nul
mkdir src\webview 2>nul
mkdir src\test 2>nul
mkdir resources 2>nul
echo Directories created!
echo.
echo Running Node.js setup...
node master-setup.js
echo.
echo Setup complete!
pause
