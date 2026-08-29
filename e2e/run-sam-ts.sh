#!/usr/bin/env bash
# Build the production Lambda/SPA artifact and run the complete Playwright
# suite against that exact bundled handler, backed by DynamoDB Local.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
BUILD_DIR="${PROJECT_ROOT}/backend-ts/.tmp/sam-e2e"
ARTIFACT_DIR="${BUILD_DIR}/Api"
SEED_SNAPSHOT="${PROJECT_ROOT}/e2e/fixtures/backend-seed.json"

port_is_in_use() {
    (echo >/dev/tcp/127.0.0.1/"$1") >/dev/null 2>&1
}

if port_is_in_use "$BACKEND_PORT"; then
    echo "Port $BACKEND_PORT is already in use. Set BACKEND_PORT to a free port." >&2
    exit 1
fi

cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

cd "${PROJECT_ROOT}/backend-ts"
npm run build:cutover
sam build --template template.yaml --build-dir "${BUILD_DIR}"
# The HTTP harness provisions DynamoDB Local through the compiled test helper;
# HANDLER_PATH below still guarantees requests execute the SAM-built bundle.
npm run build:test

PORT="${BACKEND_PORT}" \
MIGRATION_SNAPSHOT="${SEED_SNAPSHOT}" \
HANDLER_PATH="${ARTIFACT_DIR}/dist/lambda.cjs" \
FRONTEND_BUILD="${ARTIFACT_DIR}/frontend" \
node scripts/dev-server.mjs &
BACKEND_PID=$!

for i in {1..60}; do
    if curl -sf "${BACKEND_URL}/api/health/" >/dev/null 2>&1; then
        break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "SAM artifact server exited before becoming ready" >&2
        wait "$BACKEND_PID" || true
        exit 1
    fi
    if [ "$i" -eq 60 ]; then
        echo "Timeout waiting for the SAM artifact" >&2
        exit 1
    fi
    sleep 1
done

cd "${PROJECT_ROOT}/e2e"
TEST_STATUS=0
BASE_URL="${BACKEND_URL}" VITE_API_URL="${BACKEND_URL}" npm test -- "$@" || TEST_STATUS=$?
cleanup
trap - EXIT INT TERM
exit "$TEST_STATUS"
