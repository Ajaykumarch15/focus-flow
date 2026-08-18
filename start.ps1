# FocusFlow — Start all services (frontend + backend + ML)
# Run from the project root: .\start.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FocusFlow — Starting All Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start ML Service (Python)
Write-Host "[1/3] Starting ML Service (port 8000)..." -ForegroundColor Yellow
$mlPath = Join-Path $PSScriptRoot "ml-service"
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "run.py" -WorkingDirectory $mlPath
Start-Sleep -Seconds 2

# 2. Start Node Backend (port 5001)
Write-Host "[2/3] Starting Node Backend (port 5001)..." -ForegroundColor Yellow
$serverPath = Join-Path $PSScriptRoot "mainApp\server"
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $serverPath
Start-Sleep -Seconds 2

# 3. Start Vite Frontend (port 5173)
Write-Host "[3/3] Starting Frontend (port 5173)..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "mainApp"
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendPath

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All services starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:    http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API: http://localhost:5001" -ForegroundColor White
Write-Host "  ML Service:  http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor DarkGray
Write-Host ""
