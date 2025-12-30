from workouts.services import generate_sets_from_preset
from workouts.models import Exercise, WorkoutPresetExercise, SupersetExerciseItem, WorkoutSession


def test_normal_exercise_creates_correct_sets():
    exercise = Exercise(id=1, name="Bench Press", is_bodyweight=False)
    preset_ex = WorkoutPresetExercise(exercise=exercise, type="normal", sets=3)
    session = WorkoutSession(id=1, name="Test")

    sets = generate_sets_from_preset([preset_ex], session)

    assert len(sets) == 3
    for i, s in enumerate(sets):
        assert s.exercise == exercise
        assert s.set_type == "normal"
        assert s.weight == 60
        assert s.reps == 10
        assert s.set_order == i
        assert s.session == session


def test_normal_exercise_with_warmup():
    exercise = Exercise(id=1, name="Bench Press", is_bodyweight=False)
    preset_ex = WorkoutPresetExercise(exercise=exercise, type="normal", sets=3, include_warmup=True)
    session = WorkoutSession(id=1, name="Test")

    sets = generate_sets_from_preset([preset_ex], session)

    assert len(sets) == 4  # 1 warmup + 3 working sets
    assert sets[0].set_type == "normal"
    assert sets[0].weight == 30  # 60 * 0.5
    assert sets[0].set_order == 0

    for i in range(1, 4):
        assert sets[i].weight == 60
        assert sets[i].set_order == i


def test_bodyweight_exercise_creates_correct_sets():
    exercise = Exercise(id=1, name="Push-ups", is_bodyweight=True)
    preset_ex = WorkoutPresetExercise(exercise=exercise, type="normal", sets=3)
    session = WorkoutSession(id=1, name="Test")

    sets = generate_sets_from_preset([preset_ex], session)

    assert len(sets) == 3
    for i, s in enumerate(sets):
        assert s.set_type == "bodyweight"
        assert s.weight is None
        assert s.set_order == i


def test_dropdown_exercise_creates_working_and_drop_sets():
    exercise = Exercise(id=1, name="Bench Press", is_bodyweight=False)
    preset_ex = WorkoutPresetExercise(exercise=exercise, type="dropdown", sets=2, dropdowns=2)
    session = WorkoutSession(id=1, name="Test")

    sets = generate_sets_from_preset([preset_ex], session)

    # 2 working sets + 2 drop sets per working set = 6 sets
    assert len(sets) == 6

    # First working set
    assert sets[0].weight == 60
    assert sets[0].set_order == 0

    # First drop set (57.5)
    assert sets[1].weight == 57.5
    assert sets[1].set_order == 1

    # Second drop set (55)
    assert sets[2].weight == 55
    assert sets[2].set_order == 2


def test_superset_creates_round_robin_sets():
    ex1 = Exercise(id=1, name="Bench Press", is_bodyweight=False)
    ex2 = Exercise(id=2, name="Rows", is_bodyweight=False)

    sup1 = SupersetExerciseItem(exercise=ex1, sets=3)
    sup2 = SupersetExerciseItem(exercise=ex2, sets=3)

    preset_ex = WorkoutPresetExercise(type="superset")
    preset_ex.superset_exercises = [sup1, sup2]
    session = WorkoutSession(id=1, name="Test")

    sets = generate_sets_from_preset([preset_ex], session)

    # 3 sets x 2 exercises = 6 sets in round robin order
    assert len(sets) == 6
    # Round robin: ex1, ex2, ex1, ex2, ex1, ex2
    assert sets[0].exercise == ex1
    assert sets[1].exercise == ex2
    assert sets[2].exercise == ex1
    assert sets[3].exercise == ex2
    assert sets[4].exercise == ex1
    assert sets[5].exercise == ex2


def test_superset_with_warmup():
    ex1 = Exercise(id=1, name="Bench Press", is_bodyweight=False)
    ex2 = Exercise(id=2, name="Rows", is_bodyweight=False)

    sup1 = SupersetExerciseItem(exercise=ex1, sets=2, include_warmup=True)
    sup2 = SupersetExerciseItem(exercise=ex2, sets=2, include_warmup=True)

    preset_ex = WorkoutPresetExercise(type="superset")
    preset_ex.superset_exercises = [sup1, sup2]
    session = WorkoutSession(id=1, name="Test")

    sets = generate_sets_from_preset([preset_ex], session)

    # 2 warmup + 4 working = 6 sets
    assert len(sets) == 6

    # Warmup sets first (30 lbs)
    assert sets[0].exercise == ex1
    assert sets[0].weight == 30
    assert sets[1].exercise == ex2
    assert sets[1].weight == 30


def test_empty_preset_exercises():
    session = WorkoutSession(id=1, name="Test")
    sets = generate_sets_from_preset([], session)
    assert len(sets) == 0


def test_superset_with_no_items():
    preset_ex = WorkoutPresetExercise(type="superset")
    preset_ex.superset_exercises = []
    session = WorkoutSession(id=1, name="Test")
    sets = generate_sets_from_preset([preset_ex], session)
    assert len(sets) == 0


def test_preset_exercise_without_exercise():
    preset_ex = WorkoutPresetExercise(exercise=None, type="normal", sets=3)
    session = WorkoutSession(id=1, name="Test")
    sets = generate_sets_from_preset([preset_ex], session)
    assert len(sets) == 0
