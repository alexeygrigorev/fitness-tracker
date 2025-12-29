from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict

from app.schemas.workout import WorkoutPreset
from app.api.v1.auth import get_current_user
from app.models.user import User

router = APIRouter()

# Mock data - replace with database later
# Store presets by user_id: {user_id: [presets]}
MOCK_PRESETS: Dict[int, List[WorkoutPreset]] = {}
PRESET_ID_COUNTER = 1


def get_user_presets(user_id: int) -> List[WorkoutPreset]:
    """Get presets for a specific user."""
    return MOCK_PRESETS.get(user_id, [])


@router.get("", response_model=List[WorkoutPreset])
async def get_presets(current_user: User = Depends(get_current_user)):
    """Get all workout presets for the current user."""
    return get_user_presets(current_user.id)


@router.get("/{preset_id}", response_model=WorkoutPreset)
async def get_preset(preset_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific workout preset."""
    for preset in get_user_presets(current_user.id):
        if preset.id == preset_id:
            return preset
    raise HTTPException(status_code=404, detail="Preset not found")


@router.post("", response_model=WorkoutPreset, status_code=201)
async def create_preset(preset: WorkoutPreset, current_user: User = Depends(get_current_user)):
    """Create a new workout preset for the current user."""
    global PRESET_ID_COUNTER
    new_preset = WorkoutPreset(
        id=f"preset-{PRESET_ID_COUNTER}",
        name=preset.name,
        exercises=preset.exercises,
        status=preset.status or "active",
        tags=preset.tags or [],
        dayLabel=preset.dayLabel
    )
    PRESET_ID_COUNTER += 1

    # Add to user's presets
    if current_user.id not in MOCK_PRESETS:
        MOCK_PRESETS[current_user.id] = []
    MOCK_PRESETS[current_user.id].append(new_preset)
    return new_preset


@router.patch("/{preset_id}", response_model=WorkoutPreset)
async def update_preset(preset_id: str, preset: WorkoutPreset, current_user: User = Depends(get_current_user)):
    """Update a workout preset."""
    if current_user.id not in MOCK_PRESETS:
        raise HTTPException(status_code=404, detail="Preset not found")

    for i, pr in enumerate(MOCK_PRESETS[current_user.id]):
        if pr.id == preset_id:
            MOCK_PRESETS[current_user.id][i] = preset
            return MOCK_PRESETS[current_user.id][i]
    raise HTTPException(status_code=404, detail="Preset not found")


@router.delete("/{preset_id}", status_code=204)
async def delete_preset(preset_id: str, current_user: User = Depends(get_current_user)):
    """Delete a workout preset."""
    if current_user.id not in MOCK_PRESETS:
        raise HTTPException(status_code=404, detail="Preset not found")

    for i, pr in enumerate(MOCK_PRESETS[current_user.id]):
        if pr.id == preset_id:
            MOCK_PRESETS[current_user.id].pop(i)
            return
    raise HTTPException(status_code=404, detail="Preset not found")
