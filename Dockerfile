# Multi-stage Dockerfile for Fitness Tracker
# Stage 1: Build React frontend
FROM node:22-slim AS frontend-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
# Build with relative API URL (same origin) for production
RUN VITE_API_URL="" npm run build:only

# Stage 2: Backend with Python, serving both API and frontend
FROM python:3.13-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files for layer caching
COPY backend-django/pyproject.toml backend-django/uv.lock /app/backend/

# Install dependencies with uv sync
# Use --frozen for reproducible builds, --no-dev for production
WORKDIR /app/backend
RUN uv sync --frozen --no-dev

# Copy backend code
COPY backend-django /app/backend

# Copy built frontend from stage 1
RUN mkdir -p /app/frontend/dist
COPY --from=frontend-builder /app/web/dist /app/frontend/dist

# Create directory for database with proper permissions
RUN mkdir -p /app/backend/db && chmod 777 /app/backend/db

# Run migrations and start server
ENV DJANGO_SETTINGS_MODULE=config.settings
ENV SECRET_KEY=prod-secret-change-me
ENV ALLOWED_HOSTS=*
ENV DB_PATH=/app/backend/db/db.sqlite3

# Health check using Python instead of curl
HEALTHCHECK --interval=5s --timeout=5s --retries=10 --start-period=30s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health/', timeout=5)"

EXPOSE 8000

# Persist database via volume
VOLUME ["/app/backend/db"]

CMD uv run python manage.py migrate && \
    uv run python data/generate.py && \
    uv run python manage.py runserver 0.0.0.0:8000
