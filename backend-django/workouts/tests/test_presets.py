from django.test import TestCase
from workouts.services import generate_sets_from_preset
from workouts.models import Exercise, WorkoutPresetExercise, SupersetExerciseItem, WorkoutSession


class TestGenerateSets(TestCase):
    def test_normal_exercise_creates_correct_sets(self):
        exercise = Exercise(id=1, name='Bench Press', is_bodyweight=False)
        preset_ex = WorkoutPresetExercise(exercise=exercise, type='normal', sets=3, order=0)
        session = WorkoutSession(id=1, name='Test')
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 3)

    def test_normal_exercise_with_warmup(self):
        exercise = Exercise(id=1, name='Bench Press', is_bodyweight=False)
        preset_ex = WorkoutPresetExercise(exercise=exercise, type='normal', sets=3, include_warmup=True, order=0)
        session = WorkoutSession(id=1, name='Test')
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 4)
        self.assertIsNone(sets[0].weight)  # warmup has no weight

    def test_bodyweight_exercise_creates_correct_sets(self):
        exercise = Exercise(id=1, name='Push-ups', is_bodyweight=True)
        preset_ex = WorkoutPresetExercise(exercise=exercise, type='normal', sets=3, order=0)
        session = WorkoutSession(id=1, name='Test')
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 3)

    def test_dropdown_exercise_creates_working_and_drop_sets(self):
        exercise = Exercise(id=1, name='Bench Press', is_bodyweight=False)
        preset_ex = WorkoutPresetExercise(exercise=exercise, type='dropdown', sets=2, dropdowns=2, order=0)
        session = WorkoutSession(id=1, name='Test')
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 6)
        self.assertEqual(sets[0].weight, 60)
        self.assertEqual(sets[1].weight, 57.5)

    def test_superset_creates_round_robin_sets(self):
        ex1 = Exercise.objects.create(name='Bench Press', is_bodyweight=False)
        ex2 = Exercise.objects.create(name='Rows', is_bodyweight=False)
        sup1 = SupersetExerciseItem.objects.create(exercise=ex1, sets=3, order=0)
        sup2 = SupersetExerciseItem.objects.create(exercise=ex2, sets=3, order=1)
        preset_ex = WorkoutPresetExercise(type='superset', order=0)
        preset_ex.superset_exercises.set([sup1, sup2])
        preset_ex.superset_exercises = list(preset_ex.superset_exercises.all().order_by('order'))
        session = WorkoutSession(id=1, name='Test')
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 6)

    def test_superset_with_warmup(self):
        ex1 = Exercise.objects.create(name='Bench Press', is_bodyweight=False)
        ex2 = Exercise.objects.create(name='Rows', is_bodyweight=False)
        sup1 = SupersetExerciseItem.objects.create(exercise=ex1, sets=2, include_warmup=True, order=0)
        sup2 = SupersetExerciseItem.objects.create(exercise=ex2, sets=2, include_warmup=True, order=1)
        preset_ex = WorkoutPresetExercise(type='superset', order=0)
        preset_ex.superset_exercises.set([sup1, sup2])
        preset_ex.superset_exercises = list(preset_ex.superset_exercises.all().order_by('order'))
        session = WorkoutSession(id=1, name='Test')
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 6)
        self.assertIsNone(sets[0].weight)
        self.assertIsNone(sets[1].weight)


class TestComprehensiveScenarios(TestCase):
    def test_bench_press_with_warmup_and_dropdown_sets(self):
        bench_press = Exercise.objects.create(name='Bench Press', is_bodyweight=False)
        bp_exercise = WorkoutPresetExercise(
            exercise=bench_press, type='dropdown', sets=3, dropdowns=2,
            include_warmup=True, order=0
        )
        session = WorkoutSession(id=1, name='Push Day')
        sets = generate_sets_from_preset([bp_exercise], session)
        self.assertEqual(len(sets), 10)
        self.assertIsNone(sets[0].weight)
        self.assertEqual(sets[1].weight, 60)

    def test_superset_dips_and_bend_over_rows(self):
        dips = Exercise.objects.create(name='Dips', is_bodyweight=True)
        rows = Exercise.objects.create(name='Bend Over Rows', is_bodyweight=False)
        dips_item = SupersetExerciseItem.objects.create(exercise=dips, sets=4, include_warmup=False, order=0)
        rows_item = SupersetExerciseItem.objects.create(exercise=rows, sets=4, include_warmup=True, order=1)
        superset = WorkoutPresetExercise(type='superset', order=0)
        superset.superset_exercises.set([dips_item, rows_item])
        superset.superset_exercises = list(superset.superset_exercises.all().order_by('order'))
        session = WorkoutSession(id=1, name='Push Day')
        sets = generate_sets_from_preset([superset], session)
        self.assertEqual(len(sets), 9)
        self.assertIsNone(sets[0].weight)

    def test_full_push_day_scenario(self):
        bench_press = Exercise.objects.create(name='Bench Press', is_bodyweight=False)
        dips = Exercise.objects.create(name='Dips', is_bodyweight=True)
        overhead_press = Exercise.objects.create(name='Overhead Press', is_bodyweight=False)
        lateral_raises = Exercise.objects.create(name='Lateral Raises', is_bodyweight=False)
        bp = WorkoutPresetExercise(
            exercise=bench_press, type='dropdown', sets=4, dropdowns=2,
            include_warmup=True, order=0
        )
        dips_item = SupersetExerciseItem.objects.create(exercise=dips, sets=3, include_warmup=True, order=0)
        ohp_item = SupersetExerciseItem.objects.create(exercise=overhead_press, sets=3, include_warmup=True, order=1)
        superset = WorkoutPresetExercise(type='superset', order=1)
        superset.superset_exercises.set([dips_item, ohp_item])
        superset.superset_exercises = list(superset.superset_exercises.all().order_by('order'))
        laterals = WorkoutPresetExercise(
            exercise=lateral_raises, type='normal', sets=3,
            include_warmup=False, order=2
        )
        session = WorkoutSession(id=1, name='Push Day')
        sets = generate_sets_from_preset([bp, superset, laterals], session)
        self.assertEqual(len(sets), 24)
