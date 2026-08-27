#!/usr/bin/env bash
# E2E Test Runner - starts vite and the backend-ts (TypeScript/DynamoDB) dev
# server locally, then runs the Playwright suite against them. Mirrors
# run-local.sh, which exercises backend-django instead.

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

cleanup() {
    echo "Cleaning up..."

    if [ -n "$VITE_PID" ]; then
        echo "Stopping vite (PID: $VITE_PID)..."
        kill "$VITE_PID" 2>/dev/null || true
        wait "$VITE_PID" 2>/dev/null || true
    fi

    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping backend-ts (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi

    echo "Cleanup complete"
}

trap cleanup EXIT INT TERM

# Export the current Django dataset (users, exercises, presets, etc.) and load
# it into DynamoDB Local so the TS backend serves the same fixtures (e.g. the
# "test"/"test" login) that Django-backed E2E runs depend on.
echo "Exporting migration snapshot from backend-django..."
cd backend-django
uv run python manage.py export_migration_snapshot --output ../backend-ts/.tmp/migration-snapshot.json
cd ..

echo "Building backend-ts..."
cd backend-ts
npm run build:test
cd ..

echo "Starting backend-ts dev server..."
cd backend-ts
PORT="${BACKEND_PORT}" node scripts/dev-server.mjs &
BACKEND_PID=$!
cd ..

echo "Waiting for backend-ts to be ready..."
for i in {1..60}; do
    if curl -sf "${BACKEND_URL}/api/health" > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "Timeout waiting for backend-ts to start"
        exit 1
    fi
    echo "Waiting... ($i/60)"
    sleep 1
done

echo "Starting vite server..."
cd web
BACKEND_URL="${BACKEND_URL}" npm run dev -- --host 127.0.0.1 --port "${FRONTEND_PORT}" --strictPort &
VITE_PID=$!
cd ..

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

echo "Running E2E tests against backend-ts..."
cd e2e
BASE_URL="${FRONTEND_URL}" VITE_API_URL="${BACKEND_URL}" npm test -- "$@"
