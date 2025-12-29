@echo off
REM API Connectivity Test Runner - Starts backend, runs tests, cleans up

setlocal

cd /d "%~dp0.."

echo ========================================
echo Fitness Tracker API Test Runner
echo ========================================
echo.

echo [1/3] Starting backend test server on port 18081...
cd backend
start /B cmd /c "uv run python test_server.py > ..\tests\backend.log 2>&1"
cd ..

echo [2/3] Waiting for backend to be ready...
timeout /t 5 /nobreak >nul

echo [3/3] Running API tests...
echo.
cd tests
call npm run test:api
set TEST_EXIT=%ERRORLEVEL%
cd ..

echo.
echo ========================================
echo Cleaning up...
echo ========================================
taskkill /F /IM python.exe >nul 2>&1

echo.
if %TEST_EXIT% EQU 0 (
    echo Tests PASSED!
) else (
    echo Tests FAILED! Check tests\backend.log
)
echo.

exit /b %TEST_EXIT%
