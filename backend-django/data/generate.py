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
from food.models import FoodItem, Meal, MealFoodItem  # noqa: E402

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

# Create test user
test_user, created = User.objects.get_or_create(
    username="test", defaults={"email": "test@example.com"}
)

if created:
    test_user.set_password("test")
    test_user.save()
    print(f"Created test user: {test_user.username}")

# Create test2 user
test2_user, created = User.objects.get_or_create(
    username="test2", defaults={"email": "test2@example.com"}
)

if created:
    test2_user.set_password("test2")
    test2_user.save()
    print(f"Created test2 user: {test2_user.username}")

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

# Create workout presets for admin user
push_day_preset, _ = WorkoutPreset.objects.get_or_create(
    user=admin_user,
    name="Push Day",
    defaults={"notes": "Weekly push workout for chest, shoulders, and triceps", "day_label": "Monday", "status": "active", "tags": ["strength"]}
)
# Ensure day_label is Monday even if preset already existed
push_day_preset.day_label = "Monday"
push_day_preset.status = "active"
push_day_preset.save()

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
    defaults={"notes": "Weekly pull workout for back and biceps", "day_label": "Wednesday", "status": "active", "tags": ["strength"]}
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
    defaults={"notes": "Weekly leg workout", "day_label": "Friday", "status": "active", "tags": ["strength"]}
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

# Create workout presets for test user (same exercises)
test_push_preset, created = WorkoutPreset.objects.get_or_create(
    user=test_user,
    name="Push Day",
    defaults={"notes": "Weekly push workout for chest, shoulders, and triceps", "day_label": "Monday", "status": "active", "tags": ["strength"]}
)
# Ensure day_label is Monday even if preset already existed
test_push_preset.day_label = "Monday"
test_push_preset.status = "active"
test_push_preset.save()

for order, (ex_name, ex_type, ex_sets, ex_dropdowns, ex_warmup) in enumerate([
    ("Bench Press", "dropdown", 4, 2, True),
    ("Incline Dumbbell Press", "normal", 3, None, False),
    ("Overhead Press", "normal", 3, None, False),
    ("Lateral Raises", "normal", 3, None, False),
    ("Tricep Pushdowns", "normal", 4, None, False),
]):
    if ex_type == "superset":
        preset_ex, _ = WorkoutPresetExercise.objects.get_or_create(
            preset=test_push_preset,
            type=ex_type,
            defaults={"sets": ex_sets, "include_warmup": ex_warmup, "order": order}
        )
    else:
        WorkoutPresetExercise.objects.get_or_create(
            preset=test_push_preset,
            exercise=exercise_objects[ex_name],
            defaults={"type": ex_type, "sets": ex_sets, "dropdowns": ex_dropdowns, "include_warmup": ex_warmup, "order": order}
        )

test_pull_preset, _ = WorkoutPreset.objects.get_or_create(
    user=test_user,
    name="Pull Day",
    defaults={"notes": "Weekly pull workout for back and biceps", "day_label": "Wednesday", "status": "active", "tags": ["strength"]}
)
# Ensure day_label is Wednesday even if preset already existed
test_pull_preset.day_label = "Wednesday"
test_pull_preset.status = "active"
test_pull_preset.save()

for order, (ex_name, ex_type, ex_sets, ex_dropdowns, ex_warmup) in enumerate([
    ("Deadlifts", "normal", 3, None, True),
    ("Barbell Rows", "dropdown", 4, 2, False),
    ("Pull-ups", "normal", 3, None, False),
    ("Bicep Curls", "normal", 4, None, False),
]):
    WorkoutPresetExercise.objects.get_or_create(
        preset=test_pull_preset,
        exercise=exercise_objects[ex_name],
        defaults={"type": ex_type, "sets": ex_sets, "dropdowns": ex_dropdowns, "include_warmup": ex_warmup, "order": order}
    )

test_leg_preset, _ = WorkoutPreset.objects.get_or_create(
    user=test_user,
    name="Leg Day",
    defaults={"notes": "Weekly leg workout", "day_label": "Friday", "status": "active", "tags": ["strength"]}
)
# Ensure day_label is Friday even if preset already existed
test_leg_preset.day_label = "Friday"
test_leg_preset.status = "active"
test_leg_preset.save()

for order, (ex_name, ex_type, ex_sets, ex_dropdowns, ex_warmup) in enumerate([
    ("Squats", "dropdown", 4, 2, True),
    ("Leg Press", "normal", 3, None, False),
    ("Leg Extensions", "normal", 3, None, False),
    ("Leg Curls", "normal", 3, None, False),
    ("Calf Raises", "normal", 4, None, False),
]):
    WorkoutPresetExercise.objects.get_or_create(
        preset=test_leg_preset,
        exercise=exercise_objects[ex_name],
        defaults={"type": ex_type, "sets": ex_sets, "dropdowns": ex_dropdowns, "include_warmup": ex_warmup, "order": order}
    )

print("\nData generation complete!")
print(f"Admin user: admin / admin")
print(f"Test user: test / test")
print(f"Created {Exercise.objects.count()} exercises")
print(f"Created {WorkoutPreset.objects.count()} workout presets")
print(f"Created {WorkoutSession.objects.count()} workout sessions")

# Create canonical food items (available to all users)
from decimal import Decimal  # noqa: E402

food_items_data = [
    # Proteins
    ("Chicken Breast", "protein", "100.00", "g", "165", "31", "0", "3.6", "0", "0", None),
    ("Salmon Fillet", "protein", "100", "g", "208", "20", "0", "13", "0", "0", None),
    ("Eggs", "protein", "100", "g", "155", "13", "1.1", "11", "0", "0", None),
    ("Greek Yogurt", "protein", "100", "g", "59", "10", "3.6", "0.4", "0", "3.6", None),
    ("Cottage Cheese", "protein", "100", "g", "98", "11", "3.4", "4.3", "0", "1.2", None),
    ("Lean Beef", "protein", "100", "g", "250", "26", "0", "15", "0", "0", None),
    ("Tuna", "protein", "100", "g", "116", "26", "0", "1", "0", "0", None),
    ("Whey Protein", "protein", "30", "g", "120", "24", "3", "1", "0", "0", None),

    # Carbs
    ("Brown Rice", "carb", "100", "g", "111", "2.6", "23", "0.9", "1.8", "0.3", None),
    ("Oats", "carb", "100", "g", "389", "16.9", "66", "6.9", "10.6", "0.8", "54"),
    ("Sweet Potato", "carb", "100", "g", "86", "1.6", "20", "0.1", "3", "4.2", "45"),
    ("Banana", "carb", "100", "g", "89", "1.1", "23", "0.3", "2.6", "12", "51"),
    ("White Rice", "carb", "100", "g", "130", "2.7", "28", "0.3", "0.4", "0.1", "73"),
    ("Pasta", "carb", "100", "g", "131", "5", "25", "1.1", "1.5", "0.5", "45"),
    ("Quinoa", "carb", "100", "g", "120", "4.4", "21", "1.9", "2.8", "0.9", "53"),
    ("Whole Wheat Bread", "carb", "100", "g", "247", "13", "41", "3.4", "6", "5", "71"),

    # Fats
    ("Almonds", "fat", "100", "g", "579", "21", "22", "50", "12.5", "3.9", None),
    ("Peanut Butter", "fat", "100", "g", "588", "25", "20", "50", "6", "9", None),
    ("Avocado", "fat", "100", "g", "160", "2", "9", "15", "7", "0.7", None),
    ("Olive Oil", "fat", "100", "g", "884", "0", "0", "100", "0", "0", None),
    ("Cheese", "fat", "100", "g", "402", "25", "1.3", "33", "0", "1.3", None),
    ("Walnuts", "fat", "100", "g", "654", "15", "14", "65", "6.7", "2.6", "15"),

    # Mixed
    ("Hummus", "mixed", "100", "g", "166", "8", "14", "9.6", "6", "0.3", None),
    ("Lentils", "mixed", "100", "g", "116", "9", "20", "0.4", "7.9", "1.8", None),
    ("Black Beans", "mixed", "100", "g", "132", "8.9", "20", "0.5", "8.7", "1.1", None),
    ("Chickpeas", "mixed", "100", "g", "164", "8.9", "27", "2.6", "7.6", "4.8", None),
    ("Edamame", "mixed", "100", "g", "121", "12", "9", "5", "5", "2.2", "50"),

    # Beverages
    ("Water", "beverage", "100", "ml", "0", "0", "0", "0", "0", "0", None),
    ("Black Coffee", "beverage", "100", "ml", "2", "0.1", "0", "0", "0", "0", None),
    ("Green Tea", "beverage", "100", "ml", "1", "0", "0", "0", "0", "0", None),
    ("Orange Juice", "beverage", "100", "ml", "45", "0.7", "10", "0.2", "0.2", "8", "50"),
    ("Milk (Whole)", "beverage", "100", "ml", "61", "3.2", "4.8", "3.3", "0", "4.8", None),
    ("Protein Shake", "beverage", "300", "ml", "150", "25", "5", "2", "0", "2", None),
]

for (name, category, serving_size, serving_unit, calories, protein,
     carbs, fat, fiber, sugar, glycemic_index) in food_items_data:
    food, created = FoodItem.objects.get_or_create(
        name=name,
        source='canonical',
        defaults={
            "category": category,
            "serving_size": Decimal(serving_size),
            "serving_unit": serving_unit,
            "calories": Decimal(calories),
            "protein": Decimal(protein),
            "carbs": Decimal(carbs),
            "fat": Decimal(fat),
            "fiber": Decimal(fiber) if fiber != "0" else Decimal(0),
            "sugar": Decimal(sugar) if sugar != "0" else Decimal(0),
            "glycemic_index": int(glycemic_index) if glycemic_index else None,
        }
    )
    if created:
        print(f"Created food item: {food.name}")

# Create some sample meals for admin user
today = datetime.now().date()

breakfast, _ = Meal.objects.get_or_create(
    user=admin_user,
    name="Breakfast",
    date=today,
    defaults={
        "meal_type": "breakfast",
        "source": "manual"
    }
)

# Add foods to breakfast meal
eggs = FoodItem.objects.get(name="Eggs")
oats = FoodItem.objects.get(name="Oats")
banana = FoodItem.objects.get(name="Banana")

MealFoodItem.objects.get_or_create(
    meal=breakfast,
    food=eggs,
    defaults={"grams": Decimal("100"), "order": 0}
)
MealFoodItem.objects.get_or_create(
    meal=breakfast,
    food=oats,
    defaults={"grams": Decimal("80"), "order": 1}
)
MealFoodItem.objects.get_or_create(
    meal=breakfast,
    food=banana,
    defaults={"grams": Decimal("120"), "order": 2}
)

lunch, _ = Meal.objects.get_or_create(
    user=admin_user,
    name="Lunch",
    date=today,
    defaults={
        "meal_type": "lunch",
        "source": "manual"
    }
)

chicken = FoodItem.objects.get(name="Chicken Breast")
rice = FoodItem.objects.get(name="Brown Rice")
broccoli = FoodItem.objects.get_or_create(
    name="Broccoli",
    source='canonical',
    defaults={
        "category": "mixed",
        "serving_size": Decimal("100"),
        "serving_unit": "g",
        "calories": Decimal("34"),
        "protein": Decimal("2.8"),
        "carbs": Decimal("7"),
        "fat": Decimal("0.4"),
        "fiber": Decimal("2.6"),
        "sugar": Decimal("1.5"),
    }
)[0]

MealFoodItem.objects.get_or_create(
    meal=lunch,
    food=chicken,
    defaults={"grams": Decimal("150"), "order": 0}
)
MealFoodItem.objects.get_or_create(
    meal=lunch,
    food=rice,
    defaults={"grams": Decimal("100"), "order": 1}
)
MealFoodItem.objects.get_or_create(
    meal=lunch,
    food=broccoli,
    defaults={"grams": Decimal("100"), "order": 2}
)

print(f"Created {Meal.objects.count()} meals")
print(f"Created {FoodItem.objects.count()} food items")
