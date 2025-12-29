"""
Workout calculation services moved from frontend.
Handles volume calculations, set counting, and preset building logic.
"""
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime
from app.schemas.workout import (
    WorkoutSet, WorkoutPreset, WorkoutPresetExercise,
    SetRowItem, CalculateVolumeResponse
)


def is_bodyweight_exercise(exercise: Dict[str, Any]) -> bool:
    """
    Determine if an exercise is bodyweight based on equipment.
    Bodyweight exercises have no equipment or only 'bodyweight' equipment.
    """
    bodyweight = exercise.get('bodyweight', False)
    if bodyweight:
        return True

    equipment = exercise.get('equipment', [])
    if len(equipment) == 0:
        return True
    if len(equipment) == 1 and equipment[0].lower() == 'bodyweight':
        return True

    return False


def calculate_volume(sets: List[WorkoutSet]) -> CalculateVolumeResponse:
    """
    Calculate total volume from a list of sets.
    Volume = weight * reps for each completed set.
    Also counts completed sets and total sets.
    """
    total_volume = 0
    completed_sets = 0

    for s in sets:
        # Count the set
        if s.setType == 'dropdown':
            # Dropdown sets count as multiple sub-sets
            completed_sets += 1  # Each dropdown counts as 1 set
        else:
            completed_sets += 1

        # Calculate volume
        if s.weight is not None:
            total_volume += s.weight * s.reps

    return CalculateVolumeResponse(
        totalVolume=round(total_volume, 1),
        completedSets=completed_sets,
        totalSets=len(sets)
    )


def build_workout_from_preset(
    preset: WorkoutPreset,
    exercises: List[Dict[str, Any]]
) -> List[SetRowItem]:
    """
    Build set rows from a workout preset.
    This implements the complex workout building logic from ActiveWorkout.tsx.
    Handles normal sets, warmups, bodyweight sets, dropdown sets, and supersets.
    """
    items: List[SetRowItem] = []

    # Create exercise lookup
    exercise_lookup = {e['id']: e for e in exercises}

    for preset_ex in preset.exercises:
        # Handle superset - round robin order
        if preset_ex.type == 'superset' and preset_ex.exercises:
            superset_exercises = []
            for ex_def in preset_ex.exercises:
                exercise = exercise_lookup.get(ex_def.exerciseId) if ex_def.exerciseId else None
                if exercise:
                    superset_exercises.append({**ex_def.model_dump(), 'exercise': exercise})

            if not superset_exercises:
                continue

            number_of_sets = superset_exercises[0].get('sets', 3)
            base_weight = 60  # Default weight

            # Add warmup sets for each exercise in superset
            for sup_ex in superset_exercises:
                exercise = sup_ex['exercise']
                if sup_ex.get('warmup'):
                    bodyweight = is_bodyweight_exercise(exercise)
                    if bodyweight:
                        items.append(_create_warmup_set(
                            f"warmup-superset-{preset_ex.id}-{sup_ex['exerciseId']}",
                            exercise['id'],
                            exercise['name'],
                            is_superset=True
                        ))
                    else:
                        warmup_weight = int(base_weight * 0.5)
                        items.append(_create_warmup_set(
                            f"warmup-superset-{preset_ex.id}-{sup_ex['exerciseId']}",
                            exercise['id'],
                            exercise['name'],
                            weight=warmup_weight,
                            suggested_weight=warmup_weight,
                            is_superset=True
                        ))

            # Round robin: for each set number, create a row for each exercise
            for set_num in range(number_of_sets):
                for sup_ex in superset_exercises:
                    exercise = sup_ex['exercise']
                    bodyweight = is_bodyweight_exercise(exercise)
                    weight = None if bodyweight else base_weight

                    if bodyweight:
                        items.append(_create_bodyweight_set(
                            f"superset-{preset_ex.id}-{sup_ex['exerciseId']}-{set_num}",
                            exercise['id'],
                            exercise['name'],
                            set_num + 1,
                            is_superset=True
                        ))
                    else:
                        items.append(_create_normal_set(
                            f"superset-{preset_ex.id}-{sup_ex['exerciseId']}-{set_num}",
                            exercise['id'],
                            exercise['name'],
                            set_num + 1,
                            weight,
                            suggested_weight=weight,
                            is_superset=True
                        ))
            continue

        # Handle normal exercise
        exercise_id = preset_ex.exerciseId
        exercise = exercise_lookup.get(exercise_id) if exercise_id else None
        if not exercise:
            continue

        bodyweight = is_bodyweight_exercise(exercise)
        number_of_sets = preset_ex.sets or 3
        base_weight = 60  # Default weight

        # Add warmup set first (if enabled)
        if preset_ex.warmup:
            if bodyweight:
                items.append(_create_warmup_set(
                    f"warmup-{preset_ex.id}",
                    exercise['id'],
                    exercise['name']
                ))
            else:
                warmup_weight = int(base_weight * 0.5)
                items.append(_create_warmup_set(
                    f"warmup-{preset_ex.id}",
                    exercise['id'],
                    exercise['name'],
                    weight=warmup_weight,
                    suggested_weight=warmup_weight
                ))

        # Handle dropdown sets
        if preset_ex.type == 'dropdown' and preset_ex.dropdowns and not bodyweight:
            for i in range(number_of_sets):
                sub_sets = [
                    {'weight': base_weight, 'reps': 10, 'completed': False}
                ]
                for d in range(1, preset_ex.dropdowns + 1):
                    drop_weight = base_weight - (d * 2.5)
                    sub_sets.append({'weight': drop_weight, 'reps': 10, 'completed': False})

                items.append(SetRowItem(
                    id=f"dropdown-{preset_ex.id}-{i}",
                    exerciseId=exercise['id'],
                    exerciseName=exercise['name'],
                    setNumber=i + 1,
                    setType='dropdown',
                    weight=base_weight,
                    reps=10,
                    completed=False,
                    isBodyweight=False,
                    suggestedWeight=base_weight,
                    subSets=sub_sets
                ))
        else:
            # Normal sets or bodyweight sets
            for i in range(number_of_sets):
                weight = None if bodyweight else base_weight

                if bodyweight:
                    items.append(_create_bodyweight_set(
                        f"set-{preset_ex.id}-{i}",
                        exercise['id'],
                        exercise['name'],
                        i + 1
                    ))
                else:
                    items.append(_create_normal_set(
                        f"set-{preset_ex.id}-{i}",
                        exercise['id'],
                        exercise['name'],
                        i + 1,
                        weight,
                        suggested_weight=weight
                    ))

    # Add originalIndex to each item for re-sorting when uncompleted
    for idx, item in enumerate(items):
        item.originalIndex = idx

    return items


def _create_warmup_set(
    id: str,
    exercise_id: str,
    exercise_name: str,
    weight: Optional[float] = None,
    suggested_weight: Optional[float] = None,
    is_superset: bool = False
) -> SetRowItem:
    """Create a warmup set item."""
    return SetRowItem(
        id=id,
        exerciseId=exercise_id,
        exerciseName=exercise_name,
        setNumber=0,
        setType='warmup',
        weight=weight,
        reps=10,
        completed=False,
        isBodyweight=weight is None,
        suggestedWeight=suggested_weight,
        isSuperset=is_superset
    )


def _create_normal_set(
    id: str,
    exercise_id: str,
    exercise_name: str,
    set_number: int,
    weight: Optional[float] = None,
    suggested_weight: Optional[float] = None,
    is_superset: bool = False
) -> SetRowItem:
    """Create a normal set item."""
    return SetRowItem(
        id=id,
        exerciseId=exercise_id,
        exerciseName=exercise_name,
        setNumber=set_number,
        setType='normal',
        weight=weight,
        reps=10,
        completed=False,
        isBodyweight=weight is None,
        suggestedWeight=suggested_weight,
        isSuperset=is_superset
    )


def _create_bodyweight_set(
    id: str,
    exercise_id: str,
    exercise_name: str,
    set_number: int,
    is_superset: bool = False
) -> SetRowItem:
    """Create a bodyweight set item."""
    return SetRowItem(
        id=id,
        exerciseId=exercise_id,
        exerciseName=exercise_name,
        setNumber=set_number,
        setType='bodyweight',
        weight=None,
        reps=10,
        completed=False,
        isBodyweight=True,
        isSuperset=is_superset
    )


def sort_presets_by_day(presets: List[WorkoutPreset], current_day_of_week: int) -> List[WorkoutPreset]:
    """
    Sort presets: ones matching today's day first, then by day of week.
    current_day_of_week: 0=Sunday, 1=Monday, etc.
    """
    day_map = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
    }

    def get_day_value(day_label: Optional[str]) -> Optional[int]:
        if not day_label:
            return None
        return day_map.get(day_label.lower())

    return sorted(
        presets,
        key=lambda p: (
            0 if get_day_value(p.dayLabel) == current_day_of_week else
            1 if get_day_value(p.dayLabel) is not None else 2,
            get_day_value(p.dayLabel) if get_day_value(p.dayLabel) is not None else 999
        )
    )
