"""
Unit tests for workout calculation service.

Tests all workout logic that was moved from frontend to backend:
- Volume calculations
- Set type handling (normal, warmup, bodyweight, dropdown)
- Workout building from presets
- Preset sorting by day
"""
import pytest
from datetime import datetime, date
from typing import List, Dict, Any

from app.services.workout_calculations import (
    is_bodyweight_exercise,
    calculate_volume,
    build_workout_from_preset,
    sort_presets_by_day,
    _create_warmup_set,
    _create_normal_set,
    _create_bodyweight_set,
)
from app.schemas.workout import (
    WorkoutSet, WorkoutPreset, WorkoutPresetExercise, SetRowItem
)


class TestIsBodyweightExercise:
    """Tests for determining if an exercise is bodyweight."""

    def test_bodyweight_flag_true(self):
        """Test exercise with bodyweight flag set to True."""
        exercise = {'id': 'ex1', 'name': 'Pullups', 'bodyweight': True, 'equipment': []}
        assert is_bodyweight_exercise(exercise) is True

    def test_empty_equipment_list(self):
        """Test exercise with empty equipment list."""
        exercise = {'id': 'ex1', 'name': 'Pushups', 'bodyweight': False, 'equipment': []}
        assert is_bodyweight_exercise(exercise) is True

    def test_single_bodyweight_equipment(self):
        """Test exercise with only 'bodyweight' equipment."""
        exercise = {
            'id': 'ex1',
            'name': 'Dips',
            'bodyweight': False,
            'equipment': ['bodyweight']
        }
        assert is_bodyweight_exercise(exercise) is True

    def test_bodyweight_with_case_variation(self):
        """Test exercise with 'Bodyweight' (capitalized)."""
        exercise = {
            'id': 'ex1',
            'name': 'Dips',
            'bodyweight': False,
            'equipment': ['Bodyweight']
        }
        assert is_bodyweight_exercise(exercise) is True

    def test_non_bodyweight_exercise(self):
        """Test exercise with actual equipment."""
        exercise = {
            'id': 'ex1',
            'name': 'Bench Press',
            'bodyweight': False,
            'equipment': ['barbell', 'bench']
        }
        assert is_bodyweight_exercise(exercise) is False

    def test_multiple_equipment_items(self):
        """Test exercise with multiple equipment items."""
        exercise = {
            'id': 'ex1',
            'name': 'Squats',
            'bodyweight': False,
            'equipment': ['barbell', 'rack']
        }
        assert is_bodyweight_exercise(exercise) is False


class TestCalculateVolume:
    """Tests for workout volume calculation."""

    def create_workout_set(
        self,
        exercise_id: str,
        set_type: str,
        weight: float | None,
        reps: int
    ) -> WorkoutSet:
        """Helper to create a WorkoutSet."""
        return WorkoutSet(
            id=f"set-{exercise_id}-{set_type}",
            exerciseId=exercise_id,
            setType=set_type,  # type: ignore
            weight=weight,
            reps=reps,
            loggedAt=datetime.now()
        )

    def test_calculate_volume_normal_sets(self):
        """Test volume calculation for normal sets."""
        sets = [
            self.create_workout_set("ex1", "normal", 100, 10),  # 1000
            self.create_workout_set("ex1", "normal", 100, 8),   # 800
            self.create_workout_set("ex1", "normal", 90, 12),   # 1080
        ]
        result = calculate_volume(sets)
        assert result.totalVolume == 2880
        assert result.completedSets == 3
        assert result.totalSets == 3

    def test_calculate_volume_with_null_weight(self):
        """Test volume calculation when some sets have no weight."""
        sets = [
            self.create_workout_set("ex1", "normal", 100, 10),  # 1000
            self.create_workout_set("ex1", "bodyweight", None, 15),  # 0
            self.create_workout_set("ex1", "normal", 80, 10),   # 800
        ]
        result = calculate_volume(sets)
        assert result.totalVolume == 1800
        assert result.completedSets == 3

    def test_calculate_volume_warmup_sets_counted(self):
        """Test that warmup sets are counted in set count."""
        sets = [
            self.create_workout_set("ex1", "warmup", 50, 10),  # 500
            self.create_workout_set("ex1", "normal", 100, 10),  # 1000
        ]
        result = calculate_volume(sets)
        assert result.totalVolume == 1500
        assert result.completedSets == 2

    def test_calculate_volume_empty_list(self):
        """Test with empty set list."""
        result = calculate_volume([])
        assert result.totalVolume == 0
        assert result.completedSets == 0
        assert result.totalSets == 0


class TestSetRowCreation:
    """Tests for individual set row creation helpers."""

    def test_create_warmup_set_without_weight(self):
        """Test creating a bodyweight warmup set."""
        result = _create_warmup_set(
            id="warmup-1",
            exercise_id="ex1",
            exercise_name="Pullups",
            is_superset=False
        )
        assert result.id == "warmup-1"
        assert result.exerciseId == "ex1"
        assert result.exerciseName == "Pullups"
        assert result.setType == "warmup"
        assert result.weight is None
        assert result.isBodyweight is True
        assert result.isSuperset is False

    def test_create_warmup_set_with_weight(self):
        """Test creating a weighted warmup set."""
        result = _create_warmup_set(
            id="warmup-1",
            exercise_id="ex1",
            exercise_name="Squats",
            weight=60,
            suggested_weight=60,
            is_superset=False
        )
        assert result.weight == 60
        assert result.suggestedWeight == 60
        assert result.isBodyweight is False
        assert result.setType == "warmup"

    def test_create_normal_set_with_weight(self):
        """Test creating a normal working set."""
        result = _create_normal_set(
            id="set-1",
            exercise_id="ex1",
            exercise_name="Bench Press",
            set_number=1,
            weight=100,
            suggested_weight=100,
            is_superset=False
        )
        assert result.id == "set-1"
        assert result.setNumber == 1
        assert result.weight == 100
        assert result.setType == "normal"
        assert result.isBodyweight is False
        assert result.isSuperset is False

    def test_create_bodyweight_set(self):
        """Test creating a bodyweight set."""
        result = _create_bodyweight_set(
            id="set-1",
            exercise_id="ex1",
            exercise_name="Pullups",
            set_number=1,
            is_superset=False
        )
        assert result.id == "set-1"
        assert result.setNumber == 1
        assert result.weight is None
        assert result.setType == "bodyweight"
        assert result.isBodyweight is True
        assert result.isSuperset is False

    def test_create_superset_warmup_set(self):
        """Test creating a superset warmup set."""
        result = _create_warmup_set(
            id="warmup-super-1",
            exercise_id="ex1",
            exercise_name="Rows",
            weight=50,
            suggested_weight=50,
            is_superset=True
        )
        assert result.isSuperset is True
        assert result.setType == "warmup"


class TestBuildWorkoutFromPreset:
    """Tests for building workout set rows from a preset."""

    def create_exercise(
        self,
        exercise_id: str,
        name: str,
        bodyweight: bool = False,
        equipment: List[str] | None = None
    ) -> Dict[str, Any]:
        """Helper to create an exercise dict."""
        return {
            'id': exercise_id,
            'name': name,
            'bodyweight': bodyweight,
            'equipment': equipment or ([] if not bodyweight else ['bodyweight'])
        }

    def test_build_simple_normal_preset(self):
        """Test building a simple preset with normal sets."""
        preset = WorkoutPreset(
            id="preset1",
            name="Upper Body",
            exercises=[
                WorkoutPresetExercise(
                    id="ex1",
                    exerciseId="ex1",
                    type="normal",
                    sets=3
                )
            ],
            status="active"
        )
        exercises = [self.create_exercise("ex1", "Bench Press", False, ["barbell"])]

        result = build_workout_from_preset(preset, exercises)

        assert len(result) == 3  # 3 normal sets
        for i, row in enumerate(result):
            assert row.setType == "normal"
            assert row.setNumber == i + 1
            assert row.weight == 60  # Default base weight

    def test_build_preset_with_warmup(self):
        """Test building a preset with warmup sets."""
        preset = WorkoutPreset(
            id="preset1",
            name="Legs",
            exercises=[
                WorkoutPresetExercise(
                    id="ex1",
                    exerciseId="ex1",
                    type="normal",
                    sets=3,
                    warmup=True
                )
            ],
            status="active"
        )
        exercises = [self.create_exercise("ex1", "Squats", False, ["barbell"])]

        result = build_workout_from_preset(preset, exercises)

        assert len(result) == 4  # 1 warmup + 3 normal sets
        assert result[0].setType == "warmup"
        assert result[0].setNumber == 0
        for i in range(1, 4):
            assert result[i].setType == "normal"

    def test_build_bodyweight_preset(self):
        """Test building a preset with bodyweight exercises."""
        preset = WorkoutPreset(
            id="preset1",
            name="Bodyweight Arms",
            exercises=[
                WorkoutPresetExercise(
                    id="ex1",
                    exerciseId="ex1",
                    type="normal",
                    sets=3
                )
            ],
            status="active"
        )
        exercises = [self.create_exercise("ex1", "Pullups", True, [])]

        result = build_workout_from_preset(preset, exercises)

        assert len(result) == 3
        for row in result:
            assert row.setType == "bodyweight"
            assert row.isBodyweight is True
            assert row.weight is None

    def test_build_dropdown_preset(self):
        """Test building a preset with dropdown sets."""
        preset = WorkoutPreset(
            id="preset1",
            name="Drop Sets",
            exercises=[
                WorkoutPresetExercise(
                    id="ex1",
                    exerciseId="ex1",
                    type="dropdown",
                    sets=3,
                    dropdowns=2
                )
            ],
            status="active"
        )
        exercises = [self.create_exercise("ex1", "Press", False, ["dumbbell"])]

        result = build_workout_from_preset(preset, exercises)

        assert len(result) == 3
        for row in result:
            assert row.setType == "dropdown"
            assert row.subSets is not None
            assert len(row.subSets) == 3  # base + 2 drops

    def test_build_superset_preset(self):
        """Test building a preset with superset exercises."""
        preset = WorkoutPreset(
            id="preset1",
            name="Superset",
            exercises=[
                WorkoutPresetExercise(
                    id="super1",
                    type="superset",
                    exercises=[
                        WorkoutPresetExercise(
                            exerciseId="ex1",
                            type="normal",
                            sets=3
                        ),
                        WorkoutPresetExercise(
                            exerciseId="ex2",
                            type="normal",
                            sets=3
                        )
                    ]
                )
            ],
            status="active"
        )
        exercises = [
            self.create_exercise("ex1", "Bench Press", False, ["barbell"]),
            self.create_exercise("ex2", "Rows", False, ["barbell"])
        ]

        result = build_workout_from_preset(preset, exercises)

        # Should have 6 sets (3 for each exercise in round-robin)
        assert len(result) == 6
        # Check round-robin ordering
        assert result[0].exerciseId == "ex1"
        assert result[1].exerciseId == "ex2"
        assert result[2].exerciseId == "ex1"
        assert result[3].exerciseId == "ex2"
        assert result[4].exerciseId == "ex1"
        assert result[5].exerciseId == "ex2"

    def test_build_superset_with_warmup(self):
        """Test building superset with warmup enabled."""
        preset = WorkoutPreset(
            id="preset1",
            name="Superset with Warmup",
            exercises=[
                WorkoutPresetExercise(
                    id="super1",
                    type="superset",
                    exercises=[
                        WorkoutPresetExercise(
                            exerciseId="ex1",
                            type="normal",
                            sets=2,
                            warmup=True
                        ),
                        WorkoutPresetExercise(
                            exerciseId="ex2",
                            type="normal",
                            sets=2,
                            warmup=True
                        )
                    ]
                )
            ],
            status="active"
        )
        exercises = [
            self.create_exercise("ex1", "Press", False, ["barbell"]),
            self.create_exercise("ex2", "Rows", False, ["barbell"])
        ]

        result = build_workout_from_preset(preset, exercises)

        # Should have 2 warmups + 4 working sets
        assert len(result) == 6
        assert result[0].setType == "warmup"
        assert result[1].setType == "warmup"
        assert result[0].isSuperset is True

    def test_build_multiple_exercises_in_preset(self):
        """Test building preset with multiple exercises."""
        preset = WorkoutPreset(
            id="preset1",
            name="Full Body",
            exercises=[
                WorkoutPresetExercise(id="ex1", exerciseId="ex1", type="normal", sets=3),
                WorkoutPresetExercise(id="ex2", exerciseId="ex2", type="normal", sets=3),
                WorkoutPresetExercise(id="ex3", exerciseId="ex3", type="normal", sets=3),
            ],
            status="active"
        )
        exercises = [
            self.create_exercise("ex1", "Squats"),
            self.create_exercise("ex2", "Bench"),
            self.create_exercise("ex3", "Rows")
        ]

        result = build_workout_from_preset(preset, exercises)

        assert len(result) == 9
        # First 3 from ex1
        assert result[0].exerciseId == "ex1"
        assert result[1].exerciseId == "ex1"
        assert result[2].exerciseId == "ex1"
        # Next 3 from ex2
        assert result[3].exerciseId == "ex2"
        assert result[4].exerciseId == "ex2"
        assert result[5].exerciseId == "ex2"
        # Last 3 from ex3
        assert result[6].exerciseId == "ex3"
        assert result[7].exerciseId == "ex3"
        assert result[8].exerciseId == "ex3"


class TestSortPresetsByDay:
    """Tests for preset sorting by day of week."""

    def create_preset(
        self,
        preset_id: str,
        name: str,
        day_label: str | None
    ) -> WorkoutPreset:
        """Helper to create a preset."""
        return WorkoutPreset(
            id=preset_id,
            name=name,
            dayLabel=day_label,
            exercises=[],
            status="active"
        )

    def test_sort_presets_monday_first_when_monday(self):
        """Test sorting when current day is Monday (1)."""
        presets = [
            self.create_preset("p1", "Tuesday", "tuesday"),
            self.create_preset("p2", "Monday", "monday"),
            self.create_preset("p3", "Wednesday", "wednesday"),
        ]
        current_day = 1  # Monday

        result = sort_presets_by_day(presets, current_day)

        assert result[0].dayLabel == "monday"
        assert result[1].dayLabel == "tuesday"
        assert result[2].dayLabel == "wednesday"

    def test_sort_presets_no_day_label_goes_last(self):
        """Test that presets without day labels go last."""
        presets = [
            self.create_preset("p1", "No Day", None),
            self.create_preset("p2", "Monday", "monday"),
        ]
        current_day = 1  # Monday

        result = sort_presets_by_day(presets, current_day)

        assert result[0].dayLabel == "monday"
        assert result[1].dayLabel is None

    def test_sort_presets_all_different_days(self):
        """Test sorting when no preset matches current day."""
        presets = [
            self.create_preset("p1", "Friday", "friday"),
            self.create_preset("p2", "Monday", "monday"),
            self.create_preset("p3", "Wednesday", "wednesday"),
        ]
        current_day = 4  # Thursday (none match)

        result = sort_presets_by_day(presets, current_day)

        # Should be sorted by day number
        assert result[0].dayLabel == "monday"    # 1
        assert result[1].dayLabel == "wednesday"  # 3
        assert result[2].dayLabel == "friday"     # 5

    def test_sort_presets_maintains_order_for_same_day(self):
        """Test that presets for the same day maintain their original order."""
        presets = [
            self.create_preset("p1", "Monday A", "monday"),
            self.create_preset("p2", "Monday B", "monday"),
        ]
        current_day = 1  # Monday

        result = sort_presets_by_day(presets, current_day)

        assert result[0].id == "p1"
        assert result[1].id == "p2"

    def test_sort_presets_case_insensitive(self):
        """Test that day label matching is case insensitive."""
        presets = [
            self.create_preset("p1", "Upper", "MONDAY"),
            self.create_preset("p2", "Lower", "Monday"),
        ]
        current_day = 1  # Monday

        result = sort_presets_by_day(presets, current_day)

        # Both should be treated as Monday
        assert len([p for p in result if p.dayLabel and p.dayLabel.lower() == "monday"]) == 2


class TestOriginalIndex:
    """Tests for originalIndex assignment on set rows."""

    def test_original_index_assigned_to_all_rows(self):
        """Test that all set rows get an originalIndex."""
        preset = WorkoutPreset(
            id="preset1",
            name="Test",
            exercises=[
                WorkoutPresetExercise(id="ex1", exerciseId="ex1", type="normal", sets=3),
            ],
            status="active"
        )
        exercises = [{'id': 'ex1', 'name': 'Test', 'bodyweight': False, 'equipment': ['barbell']}]

        result = build_workout_from_preset(preset, exercises)

        for i, row in enumerate(result):
            assert row.originalIndex == i
