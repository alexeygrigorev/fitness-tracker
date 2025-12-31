.PHONY: help run migrate test seed shell dbshell makemigrations install test-schema test-e2e test-integration

help:
	@echo "Available commands:"
	@echo "  make run                 - Start development server"
	@echo "  make migrate             - Run database migrations"
	@echo "  make makemigrations      - Create new migrations"
	@echo "  make test                - Run backend unit tests"
	@echo "  make test-schema         - Run schema integration test (Docker)"
	@echo "  make test-e2e            - Run e2e tests (Docker)"
	@echo "  make test-integration    - Run all integration tests (Docker)"
	@echo "  make seed                - Generate sample data"
	@echo "  make shell               - Open Django shell"
	@echo "  make dbshell             - Open database shell"
	@echo "  make install             - Install dependencies"

run:
	uv run python manage.py runserver

migrate:
	uv run python manage.py migrate

migrations: migrate
	uv run python manage.py makemigrations

test:
	uv run pytest

test-schema:
	cd .. && docker compose -f docker-compose.test.yml --profile schema up --abort-on-container-exit --build

test-e2e:
	cd .. && docker compose -f docker-compose.test.yml --profile e2e up --abort-on-container-exit --build

test-integration:
	cd .. && docker compose -f docker-compose.test.yml --profile tests up --abort-on-container-exit --build

seed:
	uv run python data/generate.py

shell:
	uv run python manage.py shell

dbshell:
	uv run python manage.py dbshell

install:
	uv sync --dev
