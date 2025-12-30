from .models import (
    Exercise, WorkoutSession, WorkoutSet, WorkoutPreset,
    WorkoutPresetExercise, SupersetExerciseItem
)


def is_bodyweight(exercise: Exercise) -> bool:
    """
    Determine if an exercise is a bodyweight exercise.
    Based on web-copy/src/components/ActiveWorkout.tsx isBodyweight()
    """
    if exercise.is_bodyweight:
        return True
    # Check if equipment is empty or bodyweight
    equipment_name = exercise.equipment.name.lower() if exercise.equipment else ''
    return not equipment_name or equipment_name == 'bodyweight'


def generate_sets_from_preset(preset: WorkoutPreset, session: WorkoutSession):
    """
    Generate WorkoutSet objects from a WorkoutPreset.
    This follows the logic from web-copy/src/components/ActiveWorkout.tsx buildSetRows().

    Handles:
    - Normal exercises with optional warmup
    - Dropdown sets (weight drops)
    - Superset exercises (round robin order)
    - Bodyweight detection
    """ 
    set_order = 0

    # Get preset exercises ordered by order field
    preset_exercises = preset.exercises.all().order_by('order')

    for preset_ex in preset_exercises:
        # Handle superset type
        if preset_ex.type == 'superset':
            superset_items = preset_ex.superset_exercises.all().order_by('order')

            if not superset_items.exists():
                continue

            # Get number of sets from first item
            first_item = superset_items.first()
            number_of_sets = first_item.sets if first_item else 3
            base_weight = 60  # Default - should come from user history

            # Add warmup sets for each exercise in superset (if enabled)
            for sup_item in superset_items:
                if sup_item.include_warmup and sup_item.exercise:
                    exercise = sup_item.exercise
                    bodyweight = exercise.is_bodyweight

                    set_type = 'bodyweight' if bodyweight else 'normal'
                    weight = None if bodyweight else int(base_weight * 0.5)

                    WorkoutSet.objects.create(
                        session=session,
                        exercise=exercise,
                        set_type=set_type,
                        weight=weight,
                        reps=10,
                        set_order=set_order,
                        completed=False
                    )
                    set_order += 1

            # Round robin: for each set number, create a set for each exercise in superset
            for set_num in range(number_of_sets):
                for sup_item in superset_items:
                    exercise = sup_item.exercise
                    if not exercise:
                        continue

                    bodyweight = is_bodyweight(exercise)
                    set_type = 'bodyweight' if bodyweight else 'normal'
                    weight = None if bodyweight else base_weight

                    WorkoutSet.objects.create(
                        session=session,
                        exercise=exercise,
                        set_type=set_type,
                        weight=weight,
                        reps=10,
                        set_order=set_order,
                        completed=False
                    )
                    set_order += 1

        # Handle normal and dropdown types
        elif preset_ex.exercise:
            exercise = preset_ex.exercise
            bodyweight = is_bodyweight(exercise)
            number_of_sets = preset_ex.sets or 3
            base_weight = 60  # Default - should come from user history

            # Add warmup set first (if enabled)
            if preset_ex.include_warmup:
                set_type = 'bodyweight' if bodyweight else 'normal'
                weight = None if bodyweight else int(base_weight * 0.5)

                WorkoutSet.objects.create(
                    session=session,
                    exercise=exercise,
                    set_type=set_type,
                    weight=weight,
                    reps=10,
                    set_order=set_order,
                    completed=False
                )
                set_order += 1

            # Handle dropdown sets (only for non-bodyweight)
            if preset_ex.type == 'dropdown' and preset_ex.dropdowns and not bodyweight:
                for i in range(number_of_sets):
                    # Working set
                    WorkoutSet.objects.create(
                        session=session,
                        exercise=exercise,
                        set_type='dropdown',
                        weight=base_weight,
                        reps=10,
                        set_order=set_order,
                        completed=False
                    )
                    set_order += 1

                    # Drop sets
                    for d in range(1, preset_ex.dropdowns + 1):
                        drop_weight = base_weight - (d * 2.5)
                        WorkoutSet.objects.create(
                            session=session,
                            exercise=exercise,
                            set_type='dropdown',
                            weight=max(0, drop_weight),
                            reps=10,
                            set_order=set_order,
                            completed=False
                        )
                        set_order += 1

            # Normal sets or bodyweight sets
            else:
                for i in range(number_of_sets):
                    set_type = 'bodyweight' if bodyweight else 'normal'
                    weight = None if bodyweight else base_weight

                    WorkoutSet.objects.create(
                        session=session,
                        exercise=exercise,
                        set_type=set_type,
                        weight=weight,
                        reps=10,
                        set_order=set_order,
                        completed=False
                    )
                    set_order += 1

    return session.sets.all()
