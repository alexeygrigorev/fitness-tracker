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
    bodyweight = serializers.BooleanField(source='is_bodyweight', read_only=True)
    muscleGroups = serializers.SerializerMethodField()
    equipment = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = ['id', 'name', 'muscleGroups', 'equipment', 'bodyweight']

    def get_muscleGroups(self, obj):
        """Return muscle group names as an array."""
        return [mg.name for mg in obj.muscle_groups.all()]

    def get_equipment(self, obj):
        """Return equipment name or empty string if none."""
        return obj.equipment.name if obj.equipment else None


class WorkoutSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutSet
        fields = '__all__'


class WorkoutSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutSession
        fields = '__all__'


class SupersetExerciseItemSerializer(serializers.ModelSerializer):
    exerciseId = serializers.ReadOnlyField(source='exercise.id')

    class Meta:
        model = SupersetExerciseItem
        fields = ['id', 'exerciseId', 'type', 'dropdowns', 'include_warmup', 'order']


class WorkoutPresetExerciseSerializer(serializers.ModelSerializer):
    exerciseId = serializers.ReadOnlyField(source='exercise.id')
    includeWarmup = serializers.ReadOnlyField(source='include_warmup')
    supersetExercises = SupersetExerciseItemSerializer(
        many=True, read_only=True, source='superset_exercises'
    )

    class Meta:
        model = WorkoutPresetExercise
        fields = ['id', 'exerciseId', 'type', 'sets', 'dropdowns', 'includeWarmup', 'order', 'supersetExercises']


class WorkoutPresetExerciseSerializer(serializers.ModelSerializer):
    exerciseId = serializers.ReadOnlyField(source='exercise.id')
    includeWarmup = serializers.ReadOnlyField(source='include_warmup')
    supersetExercises = SupersetExerciseItemSerializer(
        many=True, read_only=True, source='superset_exercises'
    )

    class Meta:
        model = WorkoutPresetExercise
        fields = ['id', 'exerciseId', 'type', 'sets', 'dropdowns', 'includeWarmup', 'order', 'supersetExercises']


class WritableWorkoutPresetExerciseSerializer(serializers.ModelSerializer):
    """Writable serializer for WorkoutPresetExercise - used for updates."""
    exerciseId = serializers.IntegerField(source='exercise_id', required=True, allow_null=True)
    includeWarmup = serializers.BooleanField(source='include_warmup', required=False)

    class Meta:
        model = WorkoutPresetExercise
        fields = ['id', 'exerciseId', 'type', 'sets', 'dropdowns', 'includeWarmup', 'order']


class WorkoutPresetSerializer(serializers.ModelSerializer):
    exercises = WorkoutPresetExerciseSerializer(many=True, read_only=True)
    user_id = serializers.ReadOnlyField()
    dayLabel = serializers.ReadOnlyField(source='day_label')
    status = serializers.CharField(read_only=True)

    class Meta:
        model = WorkoutPreset
        fields = ['id', 'user_id', 'user', 'name', 'notes', 'status', 'dayLabel', 'tags', 'is_public', 'created_at', 'updated_at', 'exercises']

    def update(self, instance, validated_data):
        """Handle updating nested exercises."""
        # Extract exercises data if present (it's not in validated_data due to read_only)
        exercises_data = self.context.get('exercises_data')
        if exercises_data is not None:
            # Get existing exercise IDs
            existing_exercises = {ex.id: ex for ex in instance.exercises.all()}
            received_ids = set()

            # Update or create exercises
            for ex_data in exercises_data:
                ex_id = ex_data.get('id')
                if ex_id and ex_id in existing_exercises:
                    # Update existing exercise
                    exercise = existing_exercises[ex_id]
                    exercise.type = ex_data.get('type', exercise.type)
                    exercise.sets = ex_data.get('sets', exercise.sets)
                    exercise.dropdowns = ex_data.get('dropdowns', exercise.dropdowns)
                    exercise.include_warmup = ex_data.get('includeWarmup', exercise.include_warmup)
                    exercise.order = ex_data.get('order', exercise.order)

                    # Update exercise reference if exerciseId is provided
                    exercise_id = ex_data.get('exerciseId')
                    if exercise_id is not None:
                        exercise.exercise_id = exercise_id

                    exercise.save()
                    received_ids.add(ex_id)
                else:
                    # Create new exercise (for existing preset, should have exerciseId)
                    exercise_id = ex_data.get('exerciseId')
                    if exercise_id:
                        WorkoutPresetExercise.objects.create(
                            preset=instance,
                            exercise_id=exercise_id,
                            type=ex_data.get('type', 'normal'),
                            sets=ex_data.get('sets', 3),
                            dropdowns=ex_data.get('dropdowns'),
                            include_warmup=ex_data.get('includeWarmup', False),
                            order=ex_data.get('order', 0)
                        )

            # Delete exercises not in the received data (if we're doing a full replace)
            # For now, we'll keep existing exercises that weren't in the update

        # Update the preset fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


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
