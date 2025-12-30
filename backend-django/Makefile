.PHONY: help run migrate test seed shell dbshell makemigrations install test-integration

help:
	@echo "Available commands:"
	@echo "  make run                 - Start development server"
	@echo "  make migrate             - Run database migrations"
	@echo "  make makemigrations      - Create new migrations"
	@echo "  make test                - Run backend unit tests"
	@echo "  make test-integration    - Run all integration tests (Docker)"
	@echo "  make seed                - Generate sample data"
	@echo "  make shell               - Open Django shell"
	@echo "  make dbshell             - Open database shell"
	@echo "  make install             - Install dependencies"
	@echo ""
	@echo "For more test options, use the root Makefile:"
	@echo "  make test-schema         - Run schema integration tests only"
	@echo "  make test-e2e            - Run e2e tests only"

run:
	uv run python manage.py runserver

migrate:
	uv run python manage.py migrate

makemigrations:
	uv run python manage.py makemigrations

test:
	uv run pytest

test-integration:
	cd .. && docker compose -f docker-compose.test.yml up --abort-on-container-exit --build

seed:
	uv run python data/generate.py

shell:
	uv run python manage.py shell

dbshell:
	uv run python manage.py dbshell

install:
	uv sync --dev
