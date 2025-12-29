from rest_framework import serializers
from .models import Exercise, WorkoutSession, WorkoutSet, WorkoutPreset, WorkoutPresetExercise, ActiveWorkoutState


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = ['id', 'name', 'muscle_group', 'equipment', 'description', 'is_compound', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class WorkoutSetSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source='exercise.name', read_only=True)

    class Meta:
        model = WorkoutSet
        fields = ['id', 'exercise', 'exercise_name', 'set_type', 'weight_lbs', 'reps', 'distance_miles',
                  'duration_seconds', 'rpe', 'set_order']
        read_only_fields = ['id']


class WorkoutSessionSerializer(serializers.ModelSerializer):
    sets = WorkoutSetSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutSession
        fields = ['id', 'name', 'notes', 'date', 'duration_seconds', 'created_at', 'updated_at', 'sets']
        read_only_fields = ['id', 'created_at', 'updated_at']


class WorkoutPresetExerciseSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source='exercise.name', read_only=True)
    exercise_data = ExerciseSerializer(source='exercise', read_only=True)

    class Meta:
        model = WorkoutPresetExercise
        fields = ['id', 'exercise', 'exercise_name', 'exercise_data', 'order', 'default_sets']
        read_only_fields = ['id']


class WorkoutPresetSerializer(serializers.ModelSerializer):
    exercises = WorkoutPresetExerciseSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutPreset
        fields = ['id', 'name', 'notes', 'created_at', 'updated_at', 'exercises']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ActiveWorkoutStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActiveWorkoutState
        fields = ['id', 'preset_id', 'session_id', 'started_at', 'updated_at', 'data']
        read_only_fields = ['id', 'started_at', 'updated_at']


class VolumeCalculationRequestSerializer(serializers.Serializer):
    sets = serializers.ListField(child=serializers.DictField())
