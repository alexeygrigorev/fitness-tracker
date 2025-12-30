import os
import sys
import django
from pathlib import Path

from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from workouts.models import (  # noqa: E402
    MuscleRegion,
    MuscleGroup,
    Equipment,
    ExerciseTag,
    Exercise,
    WorkoutPreset,
    WorkoutPresetExercise,
    SupersetExerciseItem,
    WorkoutSession,
    WorkoutSet,
)

User = get_user_model()

# Create admin user
admin_user, created = User.objects.get_or_create(
    username="admin", defaults={"email": "admin@example.com"}
)

if created:
    admin_user.set_password("admin")
    admin_user.is_superuser = True
    admin_user.is_staff = True
    admin_user.save()
    print(f"Created admin user: {admin_user.username}")

# Create muscle regions
chest_region, _ = MuscleRegion.objects.get_or_create(name="Chest")
back_region, _ = MuscleRegion.objects.get_or_create(name="Back")
legs_region, _ = MuscleRegion.objects.get_or_create(name="Legs")
shoulders_region, _ = MuscleRegion.objects.get_or_create(name="Shoulders")
arms_region, _ = MuscleRegion.objects.get_or_create(name="Arms")
core_region, _ = MuscleRegion.objects.get_or_create(name="Core")

# Create muscle groups
chest_group, _ = MuscleGroup.objects.get_or_create(name="Pectoralis Major", region=chest_region)
lats_group, _ = MuscleGroup.objects.get_or_create(name="Lats", region=back_region)
quads_group, _ = MuscleGroup.objects.get_or_create(name="Quadriceps", region=legs_region)
hamstrings_group, _ = MuscleGroup.objects.get_or_create(name="Hamstrings", region=legs_region)
front_delts_group, _ = MuscleGroup.objects.get_or_create(name="Front Deltoids", region=shoulders_region)
side_delts_group, _ = MuscleGroup.objects.get_or_create(name="Side Deltoids", region=shoulders_region)
rear_delts_group, _ = MuscleGroup.objects.get_or_create(name="Rear Deltoids", region=shoulders_region)
biceps_group, _ = MuscleGroup.objects.get_or_create(name="Biceps", region=arms_region)
triceps_group, _ = MuscleGroup.objects.get_or_create(name="Triceps", region=arms_region)
abs_group, _ = MuscleGroup.objects.get_or_create(name="Abdominals", region=core_region)

# Create equipment
barbell, _ = Equipment.objects.get_or_create(name="Barbell")
dumbbell, _ = Equipment.objects.get_or_create(name="Dumbbells")
cables, _ = Equipment.objects.get_or_create(name="Cables")
machine, _ = Equipment.objects.get_or_create(name="Machine")
bodyweight, _ = Equipment.objects.get_or_create(name="Bodyweight")

# Create exercise tags
compound_tag, _ = ExerciseTag.objects.get_or_create(name="Compound")
isolation_tag, _ = ExerciseTag.objects.get_or_create(name="Isolation")
push_tag, _ = ExerciseTag.objects.get_or_create(name="Push")
pull_tag, _ = ExerciseTag.objects.get_or_create(name="Pull")

# Create glutes group for leg exercises
glutes_group, _ = MuscleGroup.objects.get_or_create(name="Glutes", region=legs_region)

# Create exercises
exercises_data = [
    ("Bench Press", False, [chest_group, front_delts_group, triceps_group], barbell, [compound_tag, push_tag]),
    ("Incline Dumbbell Press", False, [chest_group, front_delts_group, triceps_group], dumbbell, [compound_tag, push_tag]),
    ("Cable Flyes", False, [chest_group], cables, [isolation_tag, push_tag]),
    ("Pull-ups", True, [lats_group, biceps_group, rear_delts_group], bodyweight, [compound_tag, pull_tag]),
    ("Barbell Rows", False, [lats_group, rear_delts_group, biceps_group], barbell, [compound_tag, pull_tag]),
    ("Lat Pulldown", False, [lats_group, biceps_group], machine, [compound_tag, pull_tag]),
    ("Overhead Press", False, [front_delts_group, triceps_group], barbell, [compound_tag, push_tag]),
    ("Lateral Raises", False, [side_delts_group], dumbbell, [isolation_tag, push_tag]),
    ("Face Pulls", False, [rear_delts_group, triceps_group], cables, [isolation_tag, pull_tag]),
    ("Squats", False, [quads_group, hamstrings_group, glutes_group], barbell, [compound_tag, push_tag]),
    ("Deadlifts", False, [hamstrings_group, lats_group, glutes_group], barbell, [compound_tag, pull_tag]),
    ("Lunges", False, [quads_group, hamstrings_group, glutes_group], dumbbell, [compound_tag, push_tag]),
    ("Bicep Curls", False, [biceps_group], dumbbell, [isolation_tag, pull_tag]),
    ("Tricep Pushdowns", False, [triceps_group], cables, [isolation_tag, push_tag]),
]

exercise_objects = {}
for name, is_bw, muscle_groups, equipment, tags in exercises_data:
    exercise, created = Exercise.objects.get_or_create(
        name=name,
        defaults={"is_bodyweight": is_bw}
    )
    if created:
        exercise.muscle_groups.set(muscle_groups)
        exercise.equipment = equipment
        exercise.tags.set(tags)
        exercise.save()
        print(f"Created exercise: {exercise.name}")
    exercise_objects[name] = exercise

# Create workout presets
push_day_preset, _ = WorkoutPreset.objects.get_or_create(
    user=admin_user,
    name="Push Day",
    defaults={"notes": "Weekly push workout for chest, shoulders, and triceps"}
)

# Add exercises to Push Day preset
WorkoutPresetExercise.objects.get_or_create(
    preset=push_day_preset,
    exercise=exercise_objects["Bench Press"],
    defaults={"type": "dropdown", "sets": 4, "dropdowns": 2, "include_warmup": True, "order": 0}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=push_day_preset,
    exercise=exercise_objects["Incline Dumbbell Press"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 1}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=push_day_preset,
    exercise=exercise_objects["Lateral Raises"],
    defaults={"type": "normal", "sets": 4, "include_warmup": False, "order": 2}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=push_day_preset,
    exercise=exercise_objects["Overhead Press"],
    defaults={"type": "normal", "sets": 3, "include_warmup": True, "order": 3}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=push_day_preset,
    exercise=exercise_objects["Cable Flyes"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 4}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=push_day_preset,
    exercise=exercise_objects["Tricep Pushdowns"],
    defaults={"type": "normal", "sets": 4, "include_warmup": False, "order": 5}
)

pull_day_preset, _ = WorkoutPreset.objects.get_or_create(
    user=admin_user,
    name="Pull Day",
    defaults={"notes": "Weekly pull workout for back and biceps"}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Pull-ups"],
    defaults={"type": "normal", "sets": 4, "include_warmup": True, "order": 0}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Barbell Rows"],
    defaults={"type": "dropdown", "sets": 4, "dropdowns": 2, "include_warmup": False, "order": 1}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Lat Pulldown"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 2}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Face Pulls"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 3}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Bicep Curls"],
    defaults={"type": "normal", "sets": 4, "include_warmup": False, "order": 4}
)

leg_day_preset, _ = WorkoutPreset.objects.get_or_create(
    user=admin_user,
    name="Leg Day",
    defaults={"notes": "Weekly leg workout"}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=leg_day_preset,
    exercise=exercise_objects["Squats"],
    defaults={"type": "dropdown", "sets": 4, "dropdowns": 2, "include_warmup": True, "order": 0}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=leg_day_preset,
    exercise=exercise_objects["Lunges"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 1}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=leg_day_preset,
    exercise=exercise_objects["Deadlifts"],
    defaults={"type": "normal", "sets": 3, "include_warmup": True, "order": 2}
)

# Create some past workout sessions
for i in range(4):
    date = datetime.now() - timedelta(days=7 * (i + 1))
    session, created = WorkoutSession.objects.get_or_create(
        user=admin_user,
        name=f"Push Day - {date.strftime('%Y-%m-%d')}",
        defaults={
            "preset": push_day_preset,
            "notes": "Good workout!",
            "created_at": date,
        }
    )
    if created:
        print(f"Created session: {session.name}")

print("\nData generation complete!")
print(f"Admin user: admin / admin")
print(f"Created {Exercise.objects.count()} exercises")
print(f"Created {WorkoutPreset.objects.count()} workout presets")
print(f"Created {WorkoutSession.objects.count()} workout sessions")
