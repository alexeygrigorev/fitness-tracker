.PHONY: help dev dev-backend dev-frontend build test test-backend test-frontend test-integration clean

help:
	@echo "Available commands:"
	@echo "  make dev              - Start both frontend and backend in development"
	@echo "  make dev-backend      - Start backend only"
	@echo "  make dev-frontend     - Start frontend only"
	@echo "  make build            - Build frontend for production"
	@echo "  make test             - Run all tests"
	@echo "  make test-backend     - Run backend unit tests"
	@echo "  make test-frontend    - Run frontend unit tests"
	@echo "  make test-integration - Run integration tests (schema + e2e)"
	@echo "  make test-schema      - Run schema integration tests"
	@echo "  make test-e2e         - Run e2e tests"
	@echo "  make clean            - Clean build artifacts and containers"

dev:
	@echo "Starting frontend and backend..."
	@make -j2 dev-backend dev-frontend

dev-backend:
	@echo "Starting Django backend..."
	cd backend-django && uv run python manage.py runserver

dev-frontend:
	@echo "Starting Vite frontend..."
	cd web && npm run dev

build:
	@echo "Building frontend..."
	cd web && npm run build

test: test-backend test-frontend test-integration

test-backend:
	cd backend-django && uv run pytest -v

test-frontend:
	cd web && npm test

test-integration:
	docker compose -f docker-compose.test.yml --profile tests up --abort-on-container-exit --build

test-schema:
	docker compose -f docker-compose.test.yml --profile schema up --abort-on-container-exit --build

test-e2e:
	docker compose -f docker-compose.test.yml --profile e2e up --abort-on-container-exit --build

clean:
	docker compose -f docker-compose.test.yml down --remove-orphans
	cd web && rm -rf dist node_modules/.vite
