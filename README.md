# Fitness Tracker

A full-stack fitness tracking application with workout logging, nutrition tracking, sleep tracking, and more.

## Tech Stack

- **Backend**: Django REST Framework (Python 3.13) with SQLite
- **Frontend**: React + TypeScript + Vite
- **Authentication**: JWT tokens with Django auth
- **Styling**: Tailwind CSS v4
- **Icons**: FontAwesome
- **Testing**: Vitest (frontend), Playwright (E2E), pytest (backend)
- **Package Management**: uv (Python), npm (Node.js)

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js 22+
- `uv` (Python package manager) - install with `pip install uv`
- Docker (optional, for single-container deployment)

### Option 1: Docker (Recommended)

```bash
# Build and run
docker build -t fitness-tracker .
docker run -p 8000:80 -v $(pwd)/db:/app/backend/db fitness-tracker
```

Access at http://localhost:8000

### Option 2: Development Mode

**1. Backend Setup**
```bash
cd backend-django
uv sync --all-extras --dev
uv run python manage.py migrate
uv run python -m data.generate
uv run python manage.py runserver
```

**2. Frontend Setup (separate terminal)**
```bash
cd web
npm ci
npm run dev
```

Access at http://localhost:5173

### Demo Accounts

| Username | Password |
|----------|----------|
| `admin`  | `admin`  |
| `test`   | `test`   |

## Project Structure

```
fitness-tracker/
├── backend-django/      # Django REST Framework backend
│   ├── config/          # Django settings
│   ├── data/            # Data generation scripts
│   ├── food/            # Food & nutrition app
│   ├── users/           # User management app
│   ├── workouts/        # Workout & exercise app
│   └── manage.py        # Django entry point
├── web/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── api/         # API clients
│   │   ├── auth/        # Authentication context and pages
│   │   ├── food/        # Nutrition components and pages
│   │   ├── health/      # Sleep and metabolism pages
│   │   ├── types/       # Shared TypeScript types
│   │   ├── workout/     # Workout components and set helpers
│   │   └── pages/       # Page components
│   └── tests/           # Frontend unit tests
├── e2e/                 # Playwright E2E tests
└── Dockerfile           # Single-container deployment
```

## API Endpoints

### Public Routes
- `GET /api/health/` - Health check
- `POST /api/auth/register/` - Register new user
- `POST /api/auth/login/` - Login

### Protected Routes (require authentication)
- `GET /api/auth/me/` - Get current user
- `GET /api/workouts/exercises/` - List exercises
- `POST /api/workouts/exercises/` - Create exercise
- `GET /api/workouts/sessions/` - List workout sessions
- `GET /api/workouts/presets/` - List workout presets
- `GET /api/food/foods/` - List food items
- `POST /api/food/foods/` - Create food item
- `GET /api/food/meals/` - List meals

### API Documentation
- Swagger UI: `http://localhost:8000/api/docs/`
- ReDoc: `http://localhost:8000/api/redoc/`
- OpenAPI Schema: `http://localhost:8000/api/schema/`

## Data Models

### Exercises
- Exercise with muscle groups, equipment, tags
- Workout Presets (template workouts)
- Workout Sessions (logged workouts)
- Sets (weight, reps, RPE)

### Nutrition
- Food Items (macros, micros, serving sizes)
- Meals (food items with gram amounts)
- Meal Templates (reusable meal templates)

### Users
- Custom user model with dark mode preference
- JWT-based authentication

## Development

### Running Tests

```bash
# Backend tests
cd backend-django
uv run pytest -v

# Frontend unit tests
cd web
npm test

# E2E tests (requires running app)
cd e2e
npm ci
npm run install:browsers
npm test
```

### Environment Variables

**Backend** (`backend-django/.env` or as environment variables):
```bash
SECRET_KEY=your-secret-key
DB_PATH=db/db.sqlite3
ALLOWED_HOSTS=localhost,127.0.0.1
SERVE_FRONTEND=false  # Set to 'true' to have Django serve the frontend (Docker only)
```

**Frontend** (`web/.env`):
```bash
VITE_API_URL=http://127.0.0.1:8000
```

#### Frontend Serving Modes

The frontend can be served in two ways:

**Development Mode (default)**
- Frontend runs on Vite dev server (`npm run dev`) on port 5173
- Django serves API only on port 8000
- `SERVE_FRONTEND=false` or not set

**Production/Docker Mode**
- Django serves both API and frontend static files from a single container
- Frontend is pre-built and copied to `web/dist/`
- `SERVE_FRONTEND=true` enables Django to serve the frontend
- Use this for Docker builds or when testing production builds locally

To test a production build locally:
```bash
# Build the frontend
cd web
npm run build

# Start Django with SERVE_FRONTEND=true
cd ../backend-django
SERVE_FRONTEND=true uv run python manage.py runserver
```

Now Django will serve the frontend at http://localhost:8000 (same as Docker).

### Database Management

```bash
# Run migrations
cd backend-django
uv run python manage.py migrate

# Create migrations after model changes
uv run python manage.py makemigrations

# Generate sample data
uv run python -m data.generate
```

### Data Generation

The `data.generate` module creates:
- 3 demo users (admin, test, test2)
- 42 exercises across all muscle groups
- 6 workout presets (Push Day, Pull Day, Leg Day)
- 4 historical workout sessions
- 34 canonical food items
- 2 sample meals

## Deployment

The Dockerfile builds a single container serving both the React frontend (static files) and Django backend. The `SERVE_FRONTEND=true` environment variable is set in the Dockerfile to enable this mode; Gunicorn serves the WSGI application and Django static files are collected during the image build.

```bash
docker build -t fitness-tracker .
docker run -d -p 8000:80 -v fitness-db:/app/backend/db fitness-tracker
```

For a secure local container run, also set `DEBUG=false`, `SECRET_KEY`, and `DJANGO_ALLOWED_HOSTS`. The Fly deployment sets debug off explicitly and verifies that its `SECRET_KEY` secret exists before deploying.

## CI/CD

GitHub Actions runs on every push:
- Backend tests (pytest)
- Frontend tests (vitest)
- E2E tests (Playwright in Docker)
