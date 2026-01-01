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

data: migrations
	uv run python -m data.generate

test:
	uv run pytest

install:
	uv sync --dev
