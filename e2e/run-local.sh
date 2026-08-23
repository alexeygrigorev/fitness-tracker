#!/usr/bin/env bash
# E2E Test Runner - starts vite and backend locally

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"

port_is_in_use() {
    (echo >/dev/tcp/127.0.0.1/"$1") >/dev/null 2>&1
}

if port_is_in_use "$BACKEND_PORT"; then
    echo "Port $BACKEND_PORT is already in use. Set BACKEND_PORT to a free port." >&2
    exit 1
fi

if port_is_in_use "$FRONTEND_PORT"; then
    echo "Port $FRONTEND_PORT is already in use. Set FRONTEND_PORT to a free port." >&2
    exit 1
fi

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
FRONTEND_URL="${FRONTEND_URL}" uv run python manage.py runserver "127.0.0.1:${BACKEND_PORT}" &
BACKEND_PID=$!
cd ..

# Wait for backend to be healthy
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -sf "${BACKEND_URL}/api/health/" > /dev/null 2>&1; then
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
BACKEND_URL="${BACKEND_URL}" npm run dev -- --host 127.0.0.1 --port "${FRONTEND_PORT}" --strictPort &
VITE_PID=$!
cd ..

# Wait for vite to be ready
echo "Waiting for vite to be ready..."
for i in {1..30}; do
    if curl -sf "${FRONTEND_URL}/" > /dev/null 2>&1; then
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
BASE_URL="${FRONTEND_URL}" VITE_API_URL="${BACKEND_URL}" npm test -- "$@"
