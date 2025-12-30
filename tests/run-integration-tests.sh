#!/bin/bash
set -e

echo "🧪 Fitness Tracker - Integration Tests"
echo "======================================"
echo ""

cd web

# Run schema tests
echo "📋 Running schema integration tests..."
npm run test:schema

echo ""
echo "🌐 Running e2e API tests..."
npm run test:e2e

echo ""
echo "✅ All integration tests passed!"
