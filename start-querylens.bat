@echo off
echo ============================================
echo   QueryLens - SQL Query Performance Analyzer
echo ============================================
echo.

where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

docker info >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker daemon is not running.
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [INFO] Starting QueryLens...
echo.
docker compose up --build

echo.
echo ============================================
echo   QueryLens is running!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo   Health:   http://localhost:5000/api/health
echo ============================================
pause
