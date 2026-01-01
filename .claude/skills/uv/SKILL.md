---
name: uv
description: Python package manager and project manager. Show uv commands for python projects
---


Initialize a new project

```bash
uv init my-project
cd my-project
```

Initialize in current directory
```bash
uv init
```

Initialize with specific Python version
```bash
uv init --python 3.12 my-project
```

Common Commands

Install dependencies
```bash
# Install from pyproject.toml
uv sync

# Install a specific package
uv add requests

# Install with version
uv add "requests>=2.31.0"

# Install dev dependency
uv add --dev pytest
```

Run scripts
```bash
# Run a script
uv run python main.py

# Run with arguments
uv run python script.py arg1 arg2

# Run with specific Python version
uv run --python 3.11 script.py
```

Framework Setup

FastAPI backend
```bash
uv init backend
cd backend
uv add fastapi uvicorn[standard] pydantic sqlalchemy
uv run uvicorn main:app --reload --port 8000
```

Dev dependencies:
```bash
uv add --dev pytest httpx black ruff mypy
```

Django backend
```bash
uv init backend
cd backend
uv add django
uv run django-admin startproject config .
uv run python manage.py migrate
uv run python manage.py runserver
```

Common Django packages:
```bash
uv add djangorestframework django-cors-headers psycopg2-binary
uv add --dev pytest-django black ruff
```

Docker

Multi-stage Dockerfile with uv:

```dockerfile
# Stage 1: Frontend build (if you have a React/Vue/etc frontend)
FROM node:22-slim AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.13-slim

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files FIRST for layer caching
COPY backend/pyproject.toml backend/uv.lock /app/backend/

# Install dependencies (frozen = reproducible builds)
WORKDIR /app/backend
RUN uv sync --frozen --no-dev

# Copy backend code
COPY backend /app/backend

# Copy frontend build (if applicable)
COPY --from=frontend-builder /app/web/dist /app/frontend/dist

# Run commands with uv run
CMD uv run python manage.py migrate && \
    uv run python manage.py runserver 0.0.0.0:8000
```

Key points:
- `--frozen` - Lock file must be up to date, fails if not (reproducible)
- `--no-dev` - Skip dev dependencies (smaller image)
- Copy `pyproject.toml` and `uv.lock` before code for Docker layer caching
- Use `uv run` for executing commands