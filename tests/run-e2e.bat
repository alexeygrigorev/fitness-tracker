@echo off
REM E2E Test Runner - Starts servers, runs tests, cleans up

setlocal

cd /d "%~dp0.."

echo Starting backend on port 8001...
start /B cmd /c "cd backend && uv run uvicorn main:app --port 8001 > nul 2>&1"
timeout /t 3 /nobreak >nul

echo Starting frontend on port 4174...
cd web
start /B cmd /c "npm run dev -- --port 4174 --strictPort > ..\tests\frontend.log 2>&1"
cd ..

echo Waiting for servers to be ready...
timeout /t 5 /nobreak >nul

echo Running E2E tests...
cd tests
call npm run test:e2e
set TEST_EXIT=%ERRORLEVEL%
cd ..

echo Cleaning up...
taskkill /F /IM node.exe >nul 2>&1

exit /b %TEST_EXIT%
