#!/usr/bin/env bash
# E2E Test Runner - builds Docker image and runs tests against it

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"

# Build and run Docker
echo "Building Docker image..."
docker build -t fitness-tracker .

echo "Running container..."
docker stop fitness-tracker-e2e 2>/dev/null || true
docker rm fitness-tracker-e2e 2>/dev/null || true
docker run -d --name fitness-tracker-e2e -p 8000:8000 fitness-tracker

# Wait for health
echo "Waiting for app to be healthy..."
for i in {1..30}; do
  if docker exec fitness-tracker-e2e python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health/', timeout=2)" 2>/dev/null; then
    echo "App is healthy!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done

# Cleanup on exit
trap "docker stop fitness-tracker-e2e 2>/dev/null; docker rm fitness-tracker-e2e 2>/dev/null" EXIT

# Run tests
cd e2e
BASE_URL=http://localhost:8000 npm test "$@"
