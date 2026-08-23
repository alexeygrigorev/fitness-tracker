# Multi-stage Dockerfile for Fitness Tracker
# Stage 1: Build React frontend
FROM node:22-slim AS frontend-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
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

# Copy built frontend from stage 1 to location expected by Django settings
# Django settings look for BASE_DIR.parent / 'web' / 'dist' = /app/web/dist
RUN mkdir -p /app/web/dist
COPY --from=frontend-builder /app/web/dist /app/web/dist

# Collect admin and API documentation assets for WhiteNoise.
RUN uv run python manage.py collectstatic --noinput

# Create directory for database with proper permissions
RUN mkdir -p /app/backend/db && chmod 700 /app/backend/db

# Run migrations and start server
ENV DJANGO_SETTINGS_MODULE=config.settings
# Portable images default to direct HTTP. Fly opts into its trusted TLS proxy
# header through fly.toml.
ENV DJANGO_TRUST_PROXY_TLS=false
# Hosts are supplied by the platform environment (see DJANGO_ALLOWED_HOSTS).
ENV DB_PATH=/app/backend/db/db.sqlite3
ENV SERVE_FRONTEND=true

# Health check using Python instead of curl
HEALTHCHECK --interval=5s --timeout=5s --retries=10 --start-period=30s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost/api/health/', timeout=5)"

EXPOSE 80

# Persist database via volume
VOLUME ["/app/backend/db"]

CMD ["sh", "-c", "uv run --no-sync python manage.py migrate --noinput && exec .venv/bin/gunicorn --bind 0.0.0.0:80 --workers=1 --threads=4 --timeout=120 --graceful-timeout=30 --max-requests=500 --max-requests-jitter=50 --access-logfile - config.wsgi:application"]
