.PHONY: dev dev-backend dev-frontend build test test-backend test-frontend test-docker clean deploy

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

test: test-backend test-frontend

test-backend:
	cd backend-django && uv run pytest -v

test-frontend:
	cd web && npm test

test-docker:
	cd e2e && ./run-docker.sh

clean:
	docker compose -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
	docker stop fitness-tracker-e2e 2>/dev/null || true
	docker rm fitness-tracker-e2e 2>/dev/null || true
	cd web && rm -rf dist node_modules/.vite

deploy:
	@echo "Deploying to AWS ECS..."
	cd infra && ./deploy.sh
