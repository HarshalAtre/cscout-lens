# CScout-Lens Setup Script
# Creates all necessary directories and files

Write-Host "Setting up CScout-Lens improvement structure..." -ForegroundColor Green
Write-Host ""

# Create directories
$directories = @(
    "src\db",
    "src\scripts",
    "src\test",
    "src\services",
    "src\webview",
    "sample\calc",
    "resources"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created: $dir" -ForegroundColor Cyan
    } else {
        Write-Host "Exists:  $dir" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Directory structure created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm install" -ForegroundColor White
Write-Host "2. Files will be created in the next step" -ForegroundColor White
Write-Host ""
