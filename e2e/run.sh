#!/bin/bash
# E2E Test Runner
#
# Usage:
#   ./run.sh                    # Defaults to http://localhost:8000
#   ./run.sh http://localhost:5173
#   ./run.sh https://staging.example.com
#   BASE_URL=http://localhost:8000 ./run.sh

set -e

# Default to Docker instance (localhost:8000)
BASE_URL="${BASE_URL:-http://localhost:8000}"

# Allow URL argument as well
if [ -n "$1" ]; then
  BASE_URL="$1"
fi

echo "=================================="
echo "E2E Tests"
echo "=================================="
echo "Target: $BASE_URL"
echo ""

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Install browsers if needed
if ! npx playwright --version > /dev/null 2>&1; then
  echo "Installing Playwright browsers..."
  npm run install:browsers
fi

# Run tests
echo "Running tests..."
BASE_URL="$BASE_URL" npm test

echo ""
echo "✓ Tests passed!"
