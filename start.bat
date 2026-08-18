@echo off
title FocusFlow - All Services
echo.
echo ========================================
echo   FocusFlow - Starting All Services
echo ========================================
echo.

echo [1/3] Starting ML Service (port 8000)...
cd /d "%~dp0ml-service"
start /b python run.py
timeout /t 2 /nobreak >nul

echo [2/3] Starting Node Backend (port 5001)...
cd /d "%~dp0mainApp\server"
start /b npm run dev
timeout /t 2 /nobreak >nul

echo [3/3] Starting Frontend (port 5173)...
cd /d "%~dp0mainApp"
start /b npm run dev

echo.
echo ========================================
echo   All services starting!
echo ========================================
echo.
echo   Frontend:    http://localhost:5173
echo   Backend API: http://localhost:5001
echo   ML Service:  http://localhost:8000
echo.
echo Press Ctrl+C to stop all services.
echo.
pause
