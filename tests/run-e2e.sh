#!/bin/bash
# E2E Test Runner - Starts servers, runs tests, cleans up

cd "$(dirname "$0")/.."

echo "========================================"
echo "Fitness Tracker E2E Test Runner"
echo "========================================"
echo ""

echo "[1/4] Starting backend test server on port 18081..."
cd backend
python test_server.py > ../tests/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "[2/4] Waiting for backend to be ready..."
sleep 5

echo "[3/4] Starting frontend on port 3174..."
cd web
npm run dev -- --port 3174 --strictPort > ../tests/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "[4/4] Waiting for frontend to be ready..."
sleep 8

echo ""
echo "========================================"
echo "Running E2E tests..."
echo "========================================"
echo ""

cd tests
npm run test:e2e
TEST_EXIT=$?
cd ..

echo ""
echo "========================================"
echo "Cleaning up..."
echo "========================================"

# Kill the background processes
kill $BACKEND_PID 2>/dev/null
kill $FRONTEND_PID 2>/dev/null

# Also kill any uvicorn or node processes that might be left
pkill -f "uvicorn.*18081" 2>/dev/null
pkill -f "vite.*3174" 2>/dev/null

echo ""
if [ $TEST_EXIT -eq 0 ]; then
    echo "Tests PASSED!"
else
    echo "Tests FAILED! Check logs:"
    echo "  - tests/backend.log"
    echo "  - tests/frontend.log"
fi
echo ""

exit $TEST_EXIT
