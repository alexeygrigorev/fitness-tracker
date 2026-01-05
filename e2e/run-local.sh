#!/usr/bin/env bash
# E2E Test Runner - starts vite and backend locally

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"

# Function to cleanup processes on exit
cleanup() {
    echo "Cleaning up..."

    # Kill vite server
    if [ -n "$VITE_PID" ]; then
        echo "Stopping vite (PID: $VITE_PID)..."
        kill "$VITE_PID" 2>/dev/null || true
        wait "$VITE_PID" 2>/dev/null || true
    fi

    # Kill backend server
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi

    echo "Cleanup complete"
}

trap cleanup EXIT INT TERM

# Check if database exists
if [ ! -f "backend-django/db/db.sqlite3" ]; then
    echo "Database not found. Running migrations..."
    cd backend-django
    uv run python manage.py migrate
    cd ..
fi

# Start backend server
echo "Starting backend server..."
cd backend-django
uv run python manage.py runserver 127.0.0.1:8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to be healthy
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/api/health/ > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Timeout waiting for backend to start"
        exit 1
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

# Start vite server
echo "Starting vite server..."
cd web
VITE_API_URL=http://127.0.0.1:8000 npm run dev &
VITE_PID=$!
cd ..

# Wait for vite to be ready
echo "Waiting for vite to be ready..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:5173/ > /dev/null 2>&1; then
        echo "Vite is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Timeout waiting for vite to start"
        exit 1
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

# Run tests
echo "Running E2E tests..."
cd e2e
BASE_URL=http://127.0.0.1:5173 npm test "$@"
