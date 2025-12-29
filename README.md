# Fitness Tracker

A full-stack fitness tracking application with workout logging, nutrition tracking, and more.

## Tech Stack

- **Backend**: FastAPI (Python) with SQLite database
- **Frontend**: React + TypeScript + Vite
- **Authentication**: JWT tokens with bcrypt password hashing
- **Styling**: Tailwind CSS
- **Icons**: FontAwesome

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- `uv` (Python package manager)

### 1. Install Dependencies

```bash
# Backend
cd backend
uv sync

# Frontend
cd ../web
npm install
```

### 2. Initialize Database

```bash
cd backend
uv run seed_data.py
```

This creates a demo user account:

| Field | Value |
|-------|-------|
| **Username** | `demo` |
| **Password** | `demo123` |

### 3. Start Servers

**Terminal 1 - Backend:**
```bash
cd backend
uv run uvicorn main:app --port 8001
```

**Terminal 2 - Frontend:**
```bash
cd web
npm run dev
```

### 4. Access the App

Open http://localhost:5174 in your browser.

Login with:
- Username: `demo`
- Password: `demo123`

## Project Structure

```
fitness-tracker/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   ├── core/        # Config, security, database
│   │   ├── models/      # Database models
│   │   └── schemas/     # Pydantic schemas
│   ├── main.py          # FastAPI app entry point
│   └── seed_data.py     # Database seeding script
├── web/                 # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── contexts/    # Auth context
│   │   ├── lib/         # API client, types, mocks
│   │   └── pages/       # Page components
│   └── .env             # Environment variables
└── tests/               # E2E and integration tests
```

## API Endpoints

### Public Routes
- `GET /` - API info
- `GET /api/v1/health` - Health check
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login (OAuth2 password flow)

### Protected Routes (require authentication)
- `GET /api/v1/auth/me` - Get current user
- `GET /api/v1/exercises` - List exercises
- `POST /api/v1/exercises` - Create exercise
- `GET /api/v1/workouts/sessions` - List workout sessions
- `POST /api/v1/workouts/sessions` - Create workout session
- `GET /api/v1/workouts/presets` - List workout presets
- `POST /api/v1/workouts/presets` - Create workout preset

## Authentication

The app uses JWT token-based authentication:

1. Login returns an access token (30 min expiry)
2. Token is stored in localStorage
3. All protected API calls include `Authorization: Bearer <token>` header
4. 401 responses trigger redirect to login page

## Development

### Running Tests

```bash
# API connectivity tests (fast)
cd tests
npm run test:api

# E2E tests with Playwright (slower)
npm run test:e2e
```

### Environment Variables

**Backend** (`backend/.env`):
```
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///./fitness_tracker.db
```

**Frontend** (`web/.env`):
```
VITE_API_URL=http://127.0.0.1:8001
```

## Seeding Fake Data

To reset the database with fresh mock data:

```bash
cd backend
uv run seed_data.py
```

This creates:
- 1 demo user (`demo` / `demo123`)
- Sample exercises (if models are available)
- Sample workouts (if models are available)
