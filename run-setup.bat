@echo off
cd /d "D:\Gsoc\C-scout\cscout\cscout-lens"
echo Running create-sample-files.js...
node create-sample-files.js
echo.
echo Running create-ts-files.js...
node create-ts-files.js
echo.
echo Setup complete!
pause
