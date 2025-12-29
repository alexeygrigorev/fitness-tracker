"""
Active workout state persistence endpoints.
Server-side replacement for localStorage workout tracking.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Optional
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.workout import ActiveWorkoutState, ActiveWorkoutUpdate

router = APIRouter()

# Mock data - replace with database later
# Store active workouts by user_id: {user_id: ActiveWorkoutState}
MOCK_ACTIVE_WORKOUTS: Dict[int, ActiveWorkoutState] = {}


def get_user_active_workout(user_id: int) -> Optional[ActiveWorkoutState]:
    """Get active workout state for a specific user."""
    return MOCK_ACTIVE_WORKOUTS.get(user_id)


@router.get("", response_model=ActiveWorkoutState)
async def get_active_workout(current_user: User = Depends(get_current_user)):
    """Get the current active workout state for the user."""
    state = get_user_active_workout(current_user.id)
    if not state:
        raise HTTPException(status_code=404, detail="No active workout found")
    return state


@router.post("", response_model=ActiveWorkoutState, status_code=201)
async def save_active_workout(
    state: ActiveWorkoutState,
    current_user: User = Depends(get_current_user)
):
    """
    Save or update the active workout state.
    Replaces localStorage for workout persistence.
    """
    MOCK_ACTIVE_WORKOUTS[current_user.id] = state
    return state


@router.patch("", response_model=ActiveWorkoutState)
async def update_active_workout(
    update: ActiveWorkoutUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update the active workout state.
    Only updates fields that are provided.
    """
    existing = get_user_active_workout(current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="No active workout found")

    # Update only provided fields
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(existing, field, value)

    MOCK_ACTIVE_WORKOUTS[current_user.id] = existing
    return existing


@router.delete("", status_code=204)
async def clear_active_workout(current_user: User = Depends(get_current_user)):
    """
    Clear the active workout state.
    Called when workout is completed or cancelled.
    """
    if current_user.id in MOCK_ACTIVE_WORKOUTS:
        del MOCK_ACTIVE_WORKOUTS[current_user.id]
