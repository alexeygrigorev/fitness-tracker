from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, health, ai
from app.api.v1.workouts import exercises, sessions, presets, calculations, active_state
from app.api.v1.food import foods, meals, meal_templates, calculations as food_calculations
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
    allow_origins=settings.BACKEND_CORS_ORIGINS,
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
app.include_router(calculations.router, prefix="/api/v1/workouts/calculations", tags=["workout calculations"])
app.include_router(active_state.router, prefix="/api/v1/workouts/active-state", tags=["active workout state"])

# Food and nutrition routes
app.include_router(foods.router, prefix="/api/v1/food/foods", tags=["foods"])
app.include_router(meals.router, prefix="/api/v1/food/meals", tags=["meals"])
app.include_router(meal_templates.router, prefix="/api/v1/food/templates", tags=["meal templates"])
app.include_router(food_calculations.router, prefix="/api/v1/food/calculations", tags=["food calculations"])

# AI analysis routes
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai analysis"])


@app.get("/")
async def root():
    return {"message": "Fitness Tracker API", "version": "1.0.0"}
