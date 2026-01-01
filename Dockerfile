# Multi-stage Dockerfile for Fitness Tracker
# Stage 1: Build React frontend
FROM node:22-slim AS frontend-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build:only

# Stage 2: Backend with Python, serving both API and frontend
FROM python:3.13-slim

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy backend code
COPY backend-django /app/backend
WORKDIR /app/backend

# Install backend dependencies (using requirements.txt for simpler build)
RUN uv pip install -e . --system

# Copy built frontend from stage 1
RUN mkdir -p /app/frontend/dist
COPY --from=frontend-builder /app/web/dist /app/frontend/dist

# Run migrations and start server
ENV DJANGO_SETTINGS_MODULE=config.settings
ENV SECRET_KEY=prod-secret-change-me
ENV ALLOWED_HOSTS=*

EXPOSE 8000

CMD uv run python manage.py migrate && \
    uv run python data/generate.py && \
    uv run python manage.py runserver 0.0.0.0:8000
