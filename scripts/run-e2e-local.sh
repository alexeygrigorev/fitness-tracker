#!/bin/bash
set -e

echo "=================================="
echo "Fitness Tracker - Local E2E Test"
echo "=================================="
echo ""

# Clean up any running containers
echo "Cleaning up any existing containers..."
docker compose -f docker-compose.test.yml down 2>/dev/null || true

# Start backend first
echo ""
echo "Step 1: Starting backend..."
docker compose -f docker-compose.test.yml up -d backend

# Wait for backend to be healthy
echo "Waiting for backend health check..."
for i in {1..30}; do
  if curl -f http://localhost:8000/api/health/ > /dev/null 2>&1; then
    echo "✓ Backend is healthy!"
    break
  fi
  echo "  Waiting... (attempt $i/30)"
  sleep 2
done

# Start frontend
echo ""
echo "Step 2: Starting frontend..."
docker compose -f docker-compose.test.yml up -d frontend

# Wait for frontend to be ready
echo "Waiting for frontend..."
for i in {1..30}; do
  if curl -f http://localhost:5173/ > /dev/null 2>&1; then
    echo "✓ Frontend is ready!"
    break
  fi
  echo "  Waiting... (attempt $i/30)"
  sleep 2
done

# Run e2e tests
echo ""
echo "Step 3: Running e2e tests..."
docker compose -f docker-compose.test.yml run --rm e2e-test

# Capture exit code
TEST_EXIT_CODE=$?

# Clean up
echo ""
echo "Cleaning up..."
docker compose -f docker-compose.test.yml down

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✓ All tests passed!"
  exit 0
else
  echo "✗ Tests failed with exit code $TEST_EXIT_CODE"
  exit $TEST_EXIT_CODE
fi
