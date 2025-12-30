from typing import List
from .models import WorkoutSet, WorkoutSession, WorkoutPresetExercise


def generate_sets_from_preset(preset_exercises: List[WorkoutPresetExercise], session: WorkoutSession) -> List[WorkoutSet]:
    """
    Generate WorkoutSet instances (unsaved) from preset exercises.

    Args:
        preset_exercises: List of WorkoutPresetExercise
        session: WorkoutSession instance

    Returns:
        List of unsaved WorkoutSet instances
    """
    sets: List[WorkoutSet] = []
    set_order = 0
    base_weight = 60

    for preset_ex in preset_exercises:
        if preset_ex.type == "superset":
            if not preset_ex.superset_exercises:
                continue
            
            superset_items = preset_ex.superset_exercises.all().order_by('order')

            # Warmup sets
            for sup_item in superset_items:
                if sup_item.include_warmup:
                    exercise = sup_item.exercise
                    bodyweight = exercise.is_bodyweight
                    set_type = "bodyweight" if bodyweight else "normal"
                    weight = None  # Warmup sets have no weight

                    sets.append(WorkoutSet(
                        session=session,
                        exercise=exercise,
                        set_type=set_type,
                        weight=weight,
                        reps=10,
                        set_order=set_order,
                        completed_at=None
                    ))
                    set_order += 1

            # Round robin sets
            number_of_sets = preset_ex.sets

            for _ in range(number_of_sets):
                for sup_item in superset_items:
                    exercise = sup_item.exercise
                    bodyweight = exercise.is_bodyweight
                    set_type = "bodyweight" if bodyweight else "normal"
                    weight = None if bodyweight else base_weight

                    sets.append(WorkoutSet(
                        session=session,
                        exercise=exercise,
                        set_type=set_type,
                        weight=weight,
                        reps=10,
                        set_order=set_order,
                        completed_at=None
                    ))
                    set_order += 1

        elif preset_ex.exercise:
            exercise = preset_ex.exercise
            bodyweight = exercise.is_bodyweight
            number_of_sets = preset_ex.sets

            # Warmup
            if preset_ex.include_warmup:
                set_type = "bodyweight" if bodyweight else "normal"
                weight = None  # Warmup sets have no weight

                sets.append(WorkoutSet(
                    session=session,
                    exercise=exercise,
                    set_type=set_type,
                    weight=weight,
                    reps=10,
                    set_order=set_order,
                    completed_at=None
                ))
                set_order += 1

            # Dropdown
            if preset_ex.type == "dropdown" and preset_ex.dropdowns and not bodyweight:
                dropdowns = preset_ex.dropdowns
                for _ in range(number_of_sets):
                    sets.append(WorkoutSet(
                        session=session,
                        exercise=exercise,
                        set_type="dropdown",
                        weight=base_weight,
                        reps=10,
                        set_order=set_order,
                        completed_at=None
                    ))
                    set_order += 1

                    for d in range(1, dropdowns + 1):
                        sets.append(WorkoutSet(
                            session=session,
                            exercise=exercise,
                            set_type="dropdown",
                            weight=max(0, base_weight - (d * 2.5)),
                            reps=10,
                            set_order=set_order,
                            completed_at=None
                        ))
                        set_order += 1

            # Normal/Bodyweight
            else:
                for _ in range(number_of_sets):
                    set_type = "bodyweight" if bodyweight else "normal"
                    weight = None if bodyweight else base_weight

                    sets.append(WorkoutSet(
                        session=session,
                        exercise=exercise,
                        set_type=set_type,
                        weight=weight,
                        reps=10,
                        set_order=set_order,
                        completed_at=None
                    ))
                    set_order += 1

    return sets
