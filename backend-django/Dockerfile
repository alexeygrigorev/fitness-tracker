FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies
RUN uv sync --dev

# Copy application code
COPY . .

# Run migrations
RUN uv run python manage.py migrate

# Seed database with test data
RUN uv run python data/generate.py

# Expose port
EXPOSE 8000

# Run server
CMD ["uv", "run", "python", "manage.py", "runserver", "0.0.0.0:8000"]
