#!/bin/bash
set -e

echo "=================================="
echo "Fitness Tracker - Single Container E2E"
echo "=================================="
echo ""

# Clean up any running containers
echo "Cleaning up any existing containers..."
docker compose -f docker-compose.single.yml down 2>/dev/null || true

# Build and start services
echo ""
echo "Step 1: Building and starting services..."
docker compose -f docker-compose.single.yml up -d app

# Wait for services to be healthy
echo ""
echo "Waiting for services to be healthy..."
for i in {1..60}; do
  HEALTH=$(docker inspect fitness-e2e-single --format='{{.State.Health.Status}}' 2>/dev/null || echo "starting")
  if [ "$HEALTH" = "healthy" ]; then
    echo "✓ Services are healthy!"
    break
  fi
  echo "  Waiting... (attempt $i/60) - Status: $HEALTH"
  sleep 3
done

# Quick manual check
echo ""
echo "Verifying services..."
curl -f http://localhost:8000/api/health/ && echo "✓ Backend responding"
curl -f http://localhost:5173/ && echo "✓ Frontend responding"

# Run e2e tests
echo ""
echo "Step 2: Running e2e tests..."
docker compose -f docker-compose.single.yml run --rm e2e-test

# Capture exit code
TEST_EXIT_CODE=$?

# Clean up
echo ""
echo "Cleaning up..."
docker compose -f docker-compose.single.yml down

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✓ All tests passed!"
  exit 0
else
  echo "✗ Tests failed with exit code $TEST_EXIT_CODE"
  exit $TEST_EXIT_CODE
fi
