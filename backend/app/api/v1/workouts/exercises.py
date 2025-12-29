from fastapi import APIRouter, HTTPException, Depends
from typing import List

from app.schemas.exercise import ExerciseCreate, ExerciseUpdate, Exercise
from app.api.v1.auth import get_current_user
from app.models.user import User

router = APIRouter()

# Mock data - replace with database later
MOCK_EXERCISES: List[Exercise] = [
    Exercise(
        id="ex-1",
        name="Bench Press",
        category="compound",
        muscleGroups=["chest", "triceps", "shoulders"],
        equipment=["barbell", "bench"],
        instructions="Lie on bench, grip bar, lower to chest, press up."
    ),
    Exercise(
        id="ex-2",
        name="Squat",
        category="compound",
        muscleGroups=["quads", "glutes", "hamstrings"],
        equipment=["barbell", "rack"],
        instructions="Stand with bar on shoulders, squat down, stand up."
    ),
    Exercise(
        id="ex-3",
        name="Deadlift",
        category="compound",
        muscleGroups=["back", "glutes", "hamstrings"],
        equipment=["barbell"],
        instructions="Stand with bar in front, bend at hips, grip bar, stand up straight."
    ),
    Exercise(
        id="ex-4",
        name="Pull-up",
        category="compound",
        muscleGroups=["back", "biceps"],
        equipment=["bar"],
        instructions="Hang from bar, pull yourself up until chin passes bar."
    ),
    Exercise(
        id="ex-5",
        name="Overhead Press",
        category="compound",
        muscleGroups=["shoulders", "triceps"],
        equipment=["barbell", "rack"],
        instructions="Stand with bar at shoulders, press overhead until arms are extended."
    ),
    Exercise(
        id="ex-6",
        name="Bicep Curls",
        category="isolation",
        muscleGroups=["biceps"],
        equipment=["dumbbells"],
        instructions="Hold dumbbells at sides, curl up, lower slowly."
    ),
    Exercise(
        id="bw-1",
        name="Push-ups",
        category="compound",
        muscleGroups=["chest", "triceps"],
        equipment=[],
        instructions="Start in plank position, lower chest to floor, push back up."
    ),
]


@router.get("", response_model=List[Exercise])
async def get_exercises(current_user: User = Depends(get_current_user)):
    """Get all exercises."""
    return MOCK_EXERCISES


@router.get("/{exercise_id}", response_model=Exercise)
async def get_exercise(exercise_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific exercise by ID."""
    for exercise in MOCK_EXERCISES:
        if exercise.id == exercise_id:
            return exercise
    raise HTTPException(status_code=404, detail="Exercise not found")


@router.post("", response_model=Exercise, status_code=201)
async def create_exercise(exercise: ExerciseCreate, current_user: User = Depends(get_current_user)):
    """Create a new exercise."""
    new_exercise = Exercise(
        id=f"ex-{len(MOCK_EXERCISES) + 1}",
        **exercise.model_dump()
    )
    MOCK_EXERCISES.append(new_exercise)
    return new_exercise


@router.put("/{exercise_id}", response_model=Exercise)
async def update_exercise(exercise_id: str, exercise: ExerciseUpdate, current_user: User = Depends(get_current_user)):
    """Update an existing exercise."""
    for i, ex in enumerate(MOCK_EXERCISES):
        if ex.id == exercise_id:
            updated_data = exercise.model_dump(exclude_unset=True)
            MOCK_EXERCISES[i] = MOCK_EXERCISES[i].model_copy(update=updated_data)
            return MOCK_EXERCISES[i]
    raise HTTPException(status_code=404, detail="Exercise not found")


@router.delete("/{exercise_id}", status_code=204)
async def delete_exercise(exercise_id: str, current_user: User = Depends(get_current_user)):
    """Delete an exercise."""
    for i, ex in enumerate(MOCK_EXERCISES):
        if ex.id == exercise_id:
            MOCK_EXERCISES.pop(i)
            return
    raise HTTPException(status_code=404, detail="Exercise not found")
