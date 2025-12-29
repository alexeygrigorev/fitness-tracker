from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict
from datetime import datetime

from app.schemas.workout import WorkoutSession, WorkoutSessionCreate, WorkoutSessionUpdate, WorkoutSet
from app.api.v1.auth import get_current_user
from app.models.user import User

router = APIRouter()

# Mock data - replace with database later
# Store workouts by user_id: {user_id: [workouts]}
MOCK_WORKOUTS: Dict[int, List[WorkoutSession]] = {}
WORKOUT_ID_COUNTER = 1


def get_user_workouts(user_id: int) -> List[WorkoutSession]:
    """Get workouts for a specific user."""
    return MOCK_WORKOUTS.get(user_id, [])


@router.get("", response_model=List[WorkoutSession])
async def get_workouts(current_user: User = Depends(get_current_user)):
    """Get all workout sessions for the current user."""
    return get_user_workouts(current_user.id)


@router.get("/{workout_id}", response_model=WorkoutSession)
async def get_workout(workout_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific workout session by ID."""
    for workout in get_user_workouts(current_user.id):
        if workout.id == workout_id:
            return workout
    raise HTTPException(status_code=404, detail="Workout not found")


@router.post("", response_model=WorkoutSession, status_code=201)
async def create_workout(workout: WorkoutSessionCreate, current_user: User = Depends(get_current_user)):
    """Create a new workout session for the current user."""
    global WORKOUT_ID_COUNTER
    sets = workout.sets or []
    volume = sum((s.weight or 0) * s.reps for s in sets if s.weight is not None)
    new_workout = WorkoutSession(
        id=f"ws-{WORKOUT_ID_COUNTER}",
        name=workout.name,
        startedAt=workout.startedAt,
        endedAt=workout.endedAt,
        sets=sets,
        totalVolume=volume
    )
    WORKOUT_ID_COUNTER += 1

    # Add to user's workouts
    if current_user.id not in MOCK_WORKOUTS:
        MOCK_WORKOUTS[current_user.id] = []
    MOCK_WORKOUTS[current_user.id].append(new_workout)
    return new_workout


@router.patch("/{workout_id}", response_model=WorkoutSession)
async def update_workout(workout_id: str, workout: WorkoutSessionUpdate, current_user: User = Depends(get_current_user)):
    """Update an existing workout session."""
    if current_user.id not in MOCK_WORKOUTS:
        raise HTTPException(status_code=404, detail="Workout not found")

    for i, wo in enumerate(MOCK_WORKOUTS[current_user.id]):
        if wo.id == workout_id:
            # Update only provided fields
            update_data = workout.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(MOCK_WORKOUTS[current_user.id][i], field, value)
            # Recalculate volume
            updated_workout = MOCK_WORKOUTS[current_user.id][i]
            if updated_workout.sets:
                volume = sum((s.weight or 0) * s.reps for s in updated_workout.sets if s.weight is not None)
                updated_workout.totalVolume = volume
            return updated_workout
    raise HTTPException(status_code=404, detail="Workout not found")


@router.delete("/{workout_id}", status_code=204)
async def delete_workout(workout_id: str, current_user: User = Depends(get_current_user)):
    """Delete a workout session."""
    if current_user.id not in MOCK_WORKOUTS:
        raise HTTPException(status_code=404, detail="Workout not found")

    for i, wo in enumerate(MOCK_WORKOUTS[current_user.id]):
        if wo.id == workout_id:
            MOCK_WORKOUTS[current_user.id].pop(i)
            return
    raise HTTPException(status_code=404, detail="Workout not found")
