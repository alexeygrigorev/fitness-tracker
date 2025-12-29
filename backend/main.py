from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, health
from app.api.v1.workouts import exercises, sessions, presets
from app.core.config import settings
from app.core.database import engine
from app.models import User

app = FastAPI(
    title="Fitness Tracker API",
    description="Backend for Fitness Tracker application",
    version="1.0.0",
    redirect_slashes=False
)

# Create database tables
User.metadata.create_all(bind=engine)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])

# Protected routes (require authentication)
# All workout-related routes under /api/v1/workouts
# Note: Authentication is handled per-endpoint to access user object
app.include_router(exercises.router, prefix="/api/v1/workouts/exercises", tags=["exercises"])
app.include_router(sessions.router, prefix="/api/v1/workouts/sessions", tags=["workout sessions"])
app.include_router(presets.router, prefix="/api/v1/workouts/presets", tags=["workout presets"])


@app.get("/")
async def root():
    return {"message": "Fitness Tracker API", "version": "1.0.0"}
