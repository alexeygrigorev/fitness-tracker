"""
AI analysis endpoints.
Mock implementations ready for real AI API integration.
"""
from fastapi import APIRouter, Depends
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.food import (
    AnalyzeFoodRequest, AnalyzeFoodResponse,
    AnalyzeMealRequest, AnalyzeMealResponse
)
from app.schemas.workout import (
    AnalyzeExerciseRequest, AnalyzeExerciseResponse
)
from app.services.ai_service import (
    analyze_food, analyze_meal, analyze_exercise
)

router = APIRouter()


@router.post("/analyze-food", response_model=AnalyzeFoodResponse)
async def analyze_food_endpoint(
    request: AnalyzeFoodRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze food from description.
    Currently returns mock data with basic inference.
    Can be replaced with real AI API (OpenAI, Claude, etc.).
    """
    return await analyze_food(request)


@router.post("/analyze-meal", response_model=AnalyzeMealResponse)
async def analyze_meal_endpoint(
    request: AnalyzeMealRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze meal from description.
    Currently returns mock data.
    Can be replaced with real AI API.
    """
    return await analyze_meal(request)


@router.post("/analyze-exercise", response_model=AnalyzeExerciseResponse)
async def analyze_exercise_endpoint(
    request: AnalyzeExerciseRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze exercise from description.
    Currently returns mock data.
    Can be replaced with real AI API.
    """
    return await analyze_exercise(request)
