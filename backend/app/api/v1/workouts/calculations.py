"""
Workout calculation endpoints.
Volume calculations, set counting, and workout building logic.
"""
from fastapi import APIRouter, Depends
from typing import List
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.workout import (
    CalculateVolumeRequest, CalculateVolumeResponse,
    BuildWorkoutFromPresetRequest, BuildWorkoutResponse
)
from app.services.workout_calculations import (
    calculate_volume, build_workout_from_preset, sort_presets_by_day
)
from app.schemas.workout import WorkoutPreset

router = APIRouter()


@router.post("/volume", response_model=CalculateVolumeResponse)
async def calculate_volume_endpoint(
    request: CalculateVolumeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Calculate total volume from a list of sets.
    Volume = weight * reps for each set.
    Also returns completed sets count and total sets count.
    """
    return calculate_volume(request.sets)


@router.post("/build-from-preset", response_model=BuildWorkoutResponse)
async def build_workout_from_preset_endpoint(
    request: BuildWorkoutFromPresetRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Build set rows from a workout preset.
    Handles normal sets, warmups, bodyweight sets, dropdown sets, and supersets.
    This implements the complex workout building logic.
    """
    set_rows = build_workout_from_preset(request.preset, request.exercises)
    return BuildWorkoutResponse(setRows=set_rows)


@router.post("/sort-presets")
async def sort_presets_endpoint(
    presets: List[WorkoutPreset],
    current_user: User = Depends(get_current_user)
):
    """
    Sort presets: ones matching today's day first, then by day of week.
    Query param: current_day_of_week (0=Sunday, 1=Monday, etc.)
    """
    from datetime import datetime
    current_day = datetime.now().weekday()
    return sort_presets_by_day(presets, current_day)
