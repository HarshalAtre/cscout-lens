@echo off
echo ========================================
echo CScout-Lens Complete Setup
echo ========================================
echo.

echo Step 1: Creating sample C files...
node create-sample-files.js
if errorlevel 1 (
    echo ERROR: Failed to create sample files
    pause
    exit /b 1
)

echo.
echo Step 2: Installing npm dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Sample C files created in: sample\calc\
echo Dependencies installed
echo.
echo Next: I will create the TypeScript implementation files
echo.
pause
