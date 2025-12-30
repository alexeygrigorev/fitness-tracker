.PHONY: help run migrate test seed shell dbshell makemigrations install

help:
	@echo "Available commands:"
	@echo "  make run         - Start development server"
	@echo "  make migrate     - Run database migrations"
	@echo "  make makemigrations - Create new migrations"
	@echo "  make test        - Run all tests"
	@echo "  make seed        - Generate sample data"
	@echo "  make shell       - Open Django shell"
	@echo "  make dbshell     - Open database shell"
	@echo "  make install     - Install dependencies"

run:
	uv run python manage.py runserver

migrate:
	uv run python manage.py migrate

makemigrations:
	uv run python manage.py makemigrations

test:
	uv run pytest

seed:
	uv run python data/generate.py

shell:
	uv run python manage.py shell

dbshell:
	uv run python manage.py dbshell

install:
	uv sync --dev
