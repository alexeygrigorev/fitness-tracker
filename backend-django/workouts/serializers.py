from rest_framework import serializers
from .models import (
    Exercise, WorkoutSet, WorkoutSession, WorkoutPreset,
    WorkoutPlan, WorkoutPresetExercise, WorkoutPlanPreset,
    SupersetExerciseItem, MuscleGroup, MuscleRegion, Equipment, ExerciseTag
)


class MuscleRegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MuscleRegion
        fields = '__all__'


class MuscleGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = MuscleGroup
        fields = '__all__'


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = '__all__'


class ExerciseTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExerciseTag
        fields = '__all__'


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = '__all__'


class WorkoutSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutSet
        fields = '__all__'


class WorkoutSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutSession
        fields = '__all__'


class WorkoutPresetExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutPresetExercise
        fields = '__all__'


class SupersetExerciseItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupersetExerciseItem
        fields = '__all__'


class WorkoutPresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutPreset
        fields = '__all__'


class WorkoutPlanPresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutPlanPreset
        fields = '__all__'


class WorkoutPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutPlan
        fields = '__all__'


# Serializers for function-based views
class VolumeCalculationRequestSerializer(serializers.Serializer):
    """Request serializer for volume calculation endpoint"""
    sets = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of sets with weight_lbs, reps, and exercise_id"
    )


class VolumeCalculationResponseSerializer(serializers.Serializer):
    """Response serializer for volume calculation endpoint"""
    total_volume = serializers.FloatField()
    volume_by_exercise = serializers.DictField()
