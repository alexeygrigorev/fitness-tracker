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