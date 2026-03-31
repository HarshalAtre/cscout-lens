@echo off
echo Setting up CScout-Lens improvement structure...
echo.

REM Create necessary directories
if not exist "src\db" mkdir "src\db"
if not exist "src\scripts" mkdir "src\scripts"
if not exist "src\test" mkdir "src\test"
if not exist "src\services" mkdir "src\services"
if not exist "src\webview" mkdir "src\webview"
if not exist "sample" mkdir "sample"
if not exist "sample\calc" mkdir "sample\calc"
if not exist "resources" mkdir "resources"

echo Directories created successfully!
echo.
echo Next steps:
echo 1. Run: npm install
echo 2. All files will be created automatically
echo.
echo Press any key to run npm install...
pause >nul

echo.
echo Installing dependencies...
call npm install

echo.
echo Setup complete!
echo.
pause
