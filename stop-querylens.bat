@echo off
echo ============================================
echo   Stopping QueryLens...
echo ============================================
echo.
docker compose down
echo.
echo [INFO] QueryLens stopped.
echo.
set /p RESET="Remove database volume? (y/N): "
if /i "%RESET%"=="y" (
    echo [INFO] Removing volumes...
    docker compose down -v
    echo [INFO] Volumes removed. Database will be re-initialized on next start.
)
pause
