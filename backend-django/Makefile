.PHONY: run migrate test seed makemigrations install

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
