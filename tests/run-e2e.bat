@echo off
REM E2E Test Runner - Starts servers, runs tests, cleans up

setlocal

cd /d "%~dp0.."

echo ========================================
echo Fitness Tracker E2E Test Runner
echo ========================================
echo.

echo [1/4] Starting backend test server on port 18081...
cd backend
start /B cmd /c "uv run python test_server.py > ..\tests\backend.log 2>&1"
cd ..

echo [2/4] Waiting for backend to be ready...
timeout /t 5 /nobreak >nul

echo [3/4] Starting frontend on port 3174...
cd web
start /B cmd /c "npm run dev -- --port 3174 --strictPort > ..\tests\frontend.log 2>&1"
cd ..

echo [4/4] Waiting for frontend to be ready...
timeout /t 8 /nobreak >nul

echo.
echo ========================================
echo Running E2E tests...
echo ========================================
echo.
cd tests
call npm run test:e2e
set TEST_EXIT=%ERRORLEVEL%
cd ..

echo.
echo ========================================
echo Cleaning up...
echo ========================================
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo.
if %TEST_EXIT% EQU 0 (
    echo Tests PASSED!
) else (
    echo Tests FAILED! Check logs:
    echo   - tests\backend.log
    echo   - tests\frontend.log
)
echo.

exit /b %TEST_EXIT%
