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
from workouts.models import ( # noqa: E402
    ExerciseMuscleGroup, 
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

# Create muscle groups - Chest
pec_major, _ = MuscleGroup.objects.get_or_create(name="Pectoralis Major", region=chest_region)
pec_minor, _ = MuscleGroup.objects.get_or_create(name="Pectoralis Minor", region=chest_region)

# Create muscle groups - Back
lats, _ = MuscleGroup.objects.get_or_create(name="Latissimus Dorsi", region=back_region)
traps, _ = MuscleGroup.objects.get_or_create(name="Trapezius", region=back_region)
rhomboids, _ = MuscleGroup.objects.get_or_create(name="Rhomboids", region=back_region)
teres_major, _ = MuscleGroup.objects.get_or_create(name="Teres Major", region=back_region)

# Create muscle groups - Legs
quads, _ = MuscleGroup.objects.get_or_create(name="Quadriceps", region=legs_region)
hamstrings, _ = MuscleGroup.objects.get_or_create(name="Hamstrings", region=legs_region)
glute_max, _ = MuscleGroup.objects.get_or_create(name="Gluteus Maximus", region=legs_region)
glute_med, _ = MuscleGroup.objects.get_or_create(name="Gluteus Medius", region=legs_region)
glute_min, _ = MuscleGroup.objects.get_or_create(name="Gluteus Minimus", region=legs_region)
calves, _ = MuscleGroup.objects.get_or_create(name="Calves", region=legs_region)
tibialis, _ = MuscleGroup.objects.get_or_create(name="Tibialis Anterior", region=legs_region)

# Create muscle groups - Shoulders
front_delts, _ = MuscleGroup.objects.get_or_create(name="Anterior Deltoid", region=shoulders_region)
side_delts, _ = MuscleGroup.objects.get_or_create(name="Lateral Deltoid", region=shoulders_region)
rear_delts, _ = MuscleGroup.objects.get_or_create(name="Posterior Deltoid", region=shoulders_region)
rotator_cuff, _ = MuscleGroup.objects.get_or_create(name="Rotator Cuff", region=shoulders_region)

# Create muscle groups - Arms
biceps, _ = MuscleGroup.objects.get_or_create(name="Biceps Brachii", region=arms_region)
brachialis, _ = MuscleGroup.objects.get_or_create(name="Brachialis", region=arms_region)
triceps, _ = MuscleGroup.objects.get_or_create(name="Triceps Brachii", region=arms_region)
forearms, _ = MuscleGroup.objects.get_or_create(name="Forearms", region=arms_region)

# Create muscle groups - Core
rectus_abdominis, _ = MuscleGroup.objects.get_or_create(name="Rectus Abdominis", region=core_region)
obliques, _ = MuscleGroup.objects.get_or_create(name="Obliques", region=core_region)
transverse_abdominis, _ = MuscleGroup.objects.get_or_create(name="Transverse Abdominis", region=core_region)
erector_spinae, _ = MuscleGroup.objects.get_or_create(name="Erector Spinae", region=core_region)

# Create equipment
barbell, _ = Equipment.objects.get_or_create(name="Barbell")
dumbbell, _ = Equipment.objects.get_or_create(name="Dumbbells")
cables, _ = Equipment.objects.get_or_create(name="Cables")
machine, _ = Equipment.objects.get_or_create(name="Machine")
kettlebell, _ = Equipment.objects.get_or_create(name="Kettlebell")
bands, _ = Equipment.objects.get_or_create(name="Resistance Bands")

# Create exercise tags
compound_tag, _ = ExerciseTag.objects.get_or_create(name="Compound")
isolation_tag, _ = ExerciseTag.objects.get_or_create(name="Isolation")
push_tag, _ = ExerciseTag.objects.get_or_create(name="Push")
pull_tag, _ = ExerciseTag.objects.get_or_create(name="Pull")
bodyweight_tag, _ = ExerciseTag.objects.get_or_create(name="Bodyweight")

# Create exercises with detailed muscle groups
# Format: (name, is_bodyweight, primary_muscles, secondary_muscles, equipment, tags)
# For bodyweight exercises: equipment=None, add bodyweight_tag to tags
exercises_data = [
    # Chest
    ("Bench Press", False, [pec_major], [front_delts, triceps], barbell, [compound_tag, push_tag]),
    ("Incline Dumbbell Press", False, [pec_major], [front_delts, triceps], dumbbell, [compound_tag, push_tag]),
    ("Decline Bench Press", False, [pec_major], [triceps], barbell, [compound_tag, push_tag]),
    ("Cable Flyes", False, [pec_major], [], cables, [isolation_tag, push_tag]),
    ("Dips", True, [pec_major], [front_delts, triceps], None, [compound_tag, push_tag, bodyweight_tag]),
    ("Push-ups", True, [pec_major], [front_delts, triceps], None, [compound_tag, push_tag, bodyweight_tag]),

    # Back
    ("Pull-ups", True, [lats], [biceps, rear_delts], None, [compound_tag, pull_tag, bodyweight_tag]),
    ("Chin-ups", True, [lats], [biceps, rear_delts], None, [compound_tag, pull_tag, bodyweight_tag]),
    ("Barbell Rows", False, [lats], [traps, rear_delts, biceps], barbell, [compound_tag, pull_tag]),
    ("Deadlifts", False, [hamstrings, glute_max, erector_spinae], [traps], barbell, [compound_tag, pull_tag]),
    ("Lat Pulldown", False, [lats], [biceps], machine, [compound_tag, pull_tag]),
    ("Seated Cable Rows", False, [lats], [traps, rear_delts, biceps], cables, [compound_tag, pull_tag]),
    ("Face Pulls", False, [rear_delts], [traps, rotator_cuff], cables, [isolation_tag, pull_tag]),
    ("Shrugs", False, [traps], [], barbell, [isolation_tag, pull_tag]),

    # Shoulders
    ("Overhead Press", False, [front_delts, side_delts], [triceps], barbell, [compound_tag, push_tag]),
    ("Lateral Raises", False, [side_delts], [], dumbbell, [isolation_tag, push_tag]),
    ("Front Raises", False, [front_delts], [], dumbbell, [isolation_tag, push_tag]),
    ("Rear Delt Flyes", False, [rear_delts], [], dumbbell, [isolation_tag, pull_tag]),
    ("Arnold Press", False, [front_delts, side_delts], [triceps], dumbbell, [compound_tag, push_tag]),

    # Legs
    ("Squats", False, [quads], [hamstrings, glute_max], barbell, [compound_tag, push_tag]),
    ("Leg Press", False, [quads], [hamstrings, glute_max], machine, [compound_tag, push_tag]),
    ("Lunges", False, [quads], [hamstrings, glute_max], dumbbell, [compound_tag, push_tag]),
    ("Leg Extensions", False, [quads], [], machine, [isolation_tag, push_tag]),
    ("Leg Curls", False, [hamstrings], [glute_max], machine, [isolation_tag, pull_tag]),
    ("Calf Raises", False, [calves], [], machine, [isolation_tag, push_tag]),

    # Glutes
    ("Hip Thrusts", False, [glute_max], [hamstrings], barbell, [compound_tag, push_tag]),
    ("Glute Bridges", True, [glute_max], [hamstrings], None, [isolation_tag, push_tag, bodyweight_tag]),
    ("Bulgarian Split Squats", False, [glute_max], [quads, glute_med], dumbbell, [compound_tag, push_tag]),
    ("Cable Kickbacks", False, [glute_max], [], cables, [isolation_tag, pull_tag]),
    ("Side Lying Clamshells", True, [glute_med], [glute_min], None, [isolation_tag, pull_tag, bodyweight_tag]),
    ("Fire Hydrants", True, [glute_med], [], None, [isolation_tag, pull_tag, bodyweight_tag]),
    ("Abductions", False, [glute_med], [glute_min], machine, [isolation_tag, pull_tag]),

    # Arms
    ("Bicep Curls", False, [biceps], [brachialis], dumbbell, [isolation_tag, pull_tag]),
    ("Hammer Curls", False, [brachialis], [forearms], dumbbell, [isolation_tag, pull_tag]),
    ("Tricep Pushdowns", False, [triceps], [], cables, [isolation_tag, push_tag]),
    ("Skull Crushers", False, [triceps], [], dumbbell, [isolation_tag, push_tag]),
    ("Overhead Tricep Extension", False, [triceps], [], dumbbell, [isolation_tag, push_tag]),
    ("Wrist Curls", False, [forearms], [], dumbbell, [isolation_tag, pull_tag]),

    # Core
    ("Plank", True, [rectus_abdominis, transverse_abdominis], [obliques], None, [isolation_tag, pull_tag, bodyweight_tag]),
    ("Crunches", True, [rectus_abdominis], [], None, [isolation_tag, push_tag, bodyweight_tag]),
    ("Hanging Leg Raises", True, [rectus_abdominis], [obliques], None, [compound_tag, pull_tag, bodyweight_tag]),
    ("Russian Twists", True, [obliques], [rectus_abdominis], None, [isolation_tag, push_tag, bodyweight_tag]),
]

exercise_objects = {}
for name, is_bw, primary_muscles, secondary_muscles, equipment, tags in exercises_data:
    exercise, created = Exercise.objects.get_or_create(
        name=name,
        defaults={"is_bodyweight": is_bw}
    )
    if created:
        exercise.equipment = equipment
        exercise.tags.set(tags)
        exercise.save()

        # Set primary muscle groups
        for muscle in primary_muscles:
            ExerciseMuscleGroup.objects.create(
                exercise=exercise,
                muscle_group=muscle,
                target_type='primary'
            )

        # Set secondary muscle groups
        for muscle in secondary_muscles:
            ExerciseMuscleGroup.objects.create(
                exercise=exercise,
                muscle_group=muscle,
                target_type='secondary'
            )

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
    exercise=exercise_objects["Overhead Press"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 2}
)

# Create superset for shoulders (Lateral Raises + Front Raises)
shoulders_superset, _ = WorkoutPresetExercise.objects.get_or_create(
    preset=push_day_preset,
    type="superset",
    defaults={"sets": 3, "include_warmup": False, "order": 3}
)

SupersetExerciseItem.objects.get_or_create(
    superset=shoulders_superset,
    exercise=exercise_objects["Lateral Raises"],
    defaults={"order": 0, "include_warmup": False}
)

SupersetExerciseItem.objects.get_or_create(
    superset=shoulders_superset,
    exercise=exercise_objects["Front Raises"],
    defaults={"order": 1, "include_warmup": False}
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
    exercise=exercise_objects["Deadlifts"],
    defaults={"type": "normal", "sets": 3, "include_warmup": True, "order": 0}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Barbell Rows"],
    defaults={"type": "dropdown", "sets": 4, "dropdowns": 2, "include_warmup": False, "order": 1}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Pull-ups"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 2}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Lat Pulldown"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 3}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Face Pulls"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 4}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=pull_day_preset,
    exercise=exercise_objects["Bicep Curls"],
    defaults={"type": "normal", "sets": 4, "include_warmup": False, "order": 5}
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
    exercise=exercise_objects["Leg Press"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 1}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=leg_day_preset,
    exercise=exercise_objects["Leg Extensions"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 2}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=leg_day_preset,
    exercise=exercise_objects["Leg Curls"],
    defaults={"type": "normal", "sets": 3, "include_warmup": False, "order": 3}
)

WorkoutPresetExercise.objects.get_or_create(
    preset=leg_day_preset,
    exercise=exercise_objects["Calf Raises"],
    defaults={"type": "normal", "sets": 4, "include_warmup": False, "order": 4}
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
