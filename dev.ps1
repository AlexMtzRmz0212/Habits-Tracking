# Habits-Tracking Dev Server Launcher
# Run from the root directory: .\dev.ps1

Write-Host ""
Write-Host "Starting Habits-Tracking dev environment..."
Write-Host ""

# Check if .env file exists in root
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: No .env file found in root folder!"
    Write-Host "Please create .env in the root directory with your database credentials."
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Navigate to web directory
Set-Location web

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
    Write-Host ""
}

# next.config.mjs loads ../.env directly at startup, so nothing needs to be
# copied into web/ here.

# Open Chrome in incognito mode
Write-Host "Opening http://localhost:3000 in Chrome (incognito)..."
Start-Process chrome -ArgumentList "--incognito http://localhost:3000"

# Start dev server in current window
Write-Host ""
Write-Host "Starting Next.js dev server..."
Write-Host ""

npm run dev

# Go back to root directory when dev server closes
Set-Location ..
