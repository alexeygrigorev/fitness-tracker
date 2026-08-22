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


class BodyweightField(serializers.BooleanField):
    def get_attribute(self, instance):
        return instance.is_bodyweight


class MuscleGroupNamesField(serializers.ListField):
    def __init__(self, **kwargs):
        kwargs.setdefault('child', serializers.CharField())
        super().__init__(**kwargs)

    def get_attribute(self, instance):
        return list(instance.muscle_groups.values_list('name', flat=True))


class EquipmentNameField(serializers.CharField):
    def get_attribute(self, instance):
        return instance.equipment.name if instance.equipment else None


UNSET = object()


class ExerciseSerializer(serializers.ModelSerializer):
    bodyweight = BodyweightField(required=False)
    muscleGroups = MuscleGroupNamesField(required=False)
    equipment = EquipmentNameField(allow_null=True, allow_blank=True, required=False)
    category = serializers.ChoiceField(choices=Exercise.CATEGORY_CHOICES, required=False)

    class Meta:
        model = Exercise
        fields = [
            'id', 'name', 'muscleGroups', 'equipment', 'bodyweight',
            'category', 'instructions',
        ]

    def to_internal_value(self, data):
        data = dict(data)

        # Older clients predated category/bodyweight as first-class fields.
        if 'is_bodyweight' in data and 'bodyweight' not in data:
            data['bodyweight'] = data.pop('is_bodyweight')
        if 'is_compound' in data and 'category' not in data:
            data['category'] = 'compound' if data.pop('is_compound') else 'isolation'

        return super().to_internal_value(data)

    def _apply_related_fields(self, exercise, validated_data):
        muscle_group_names = validated_data.pop('muscleGroups', None)
        equipment_name = validated_data.pop('equipment', UNSET)
        category = validated_data.pop('category', exercise.category)
        bodyweight = validated_data.pop('bodyweight', exercise.is_bodyweight)

        exercise.category = category
        exercise.is_compound = category == 'compound'
        exercise.is_bodyweight = bodyweight
        for field, value in validated_data.items():
            setattr(exercise, field, value)
        exercise.save()

        if equipment_name is UNSET:
            pass
        elif equipment_name is None:
            exercise.equipment = None
        else:
            equipment_name = equipment_name.strip()
            if equipment_name:
                equipment, _ = Equipment.objects.get_or_create(
                    name__iexact=equipment_name,
                    defaults={'name': equipment_name},
                )
                exercise.equipment = equipment
            else:
                exercise.equipment = None

        if muscle_group_names is not None:
            muscle_groups = []
            for name in muscle_group_names:
                normalized_name = name.strip()
                if not normalized_name:
                    continue
                muscle_group, _ = MuscleGroup.objects.get_or_create(
                    name__iexact=normalized_name,
                    defaults={'name': normalized_name},
                )
                muscle_groups.append(muscle_group)
            exercise.muscle_groups.set(muscle_groups)

        exercise.save()
        return exercise

    def create(self, validated_data):
        validated_data.setdefault('muscleGroups', [])
        validated_data.setdefault('equipment', None)
        if validated_data.get('instructions') is None:
            validated_data['instructions'] = []

        exercise = Exercise.objects.create(**{
            key: value for key, value in validated_data.items()
            if key not in {'muscleGroups', 'equipment', 'category', 'bodyweight'}
        })
        return self._apply_related_fields(exercise, validated_data)

    def update(self, instance, validated_data):
        return self._apply_related_fields(instance, validated_data)


class WorkoutSetSerializer(serializers.ModelSerializer):
    exerciseId = serializers.ReadOnlyField(source='exercise.id')
    exerciseName = serializers.ReadOnlyField(source='exercise.name')  # Include exercise name for fallback matching
    # Use a custom method field to ensure loggedAt is always included
    loggedAt = serializers.SerializerMethodField()
    dropdownWeights = serializers.JSONField(source='dropdown_weights', required=False)
    setType = serializers.CharField(source='set_type')
    # Return weight as a number (not string) - use Decimal with coerce_to_string=False
    weight = serializers.DecimalField(max_digits=6, decimal_places=2, allow_null=True, required=False, coerce_to_string=False)

    def get_loggedAt(self, obj):
        """Always return completed_at, even if None."""
        return obj.completed_at

    class Meta:
        model = WorkoutSet
        # Use camelCase for frontend
        fields = ['id', 'exerciseId', 'exerciseName', 'session', 'set_order', 'setType', 'weight', 'reps', 'dropdownWeights', 'loggedAt']


class WorkoutSessionSerializer(serializers.ModelSerializer):
    sets = WorkoutSetSerializer(many=True, read_only=True)
    startedAt = serializers.DateTimeField(source='created_at')
    endedAt = serializers.DateTimeField(source='finished_at', allow_null=True)
    bodyweight = serializers.DecimalField(max_digits=6, decimal_places=2, allow_null=True, required=False, coerce_to_string=False)

    def to_representation(self, instance):
        """Ensure sets are always included in the representation."""
        data = super().to_representation(instance)
        return data

    class Meta:
        model = WorkoutSession
        # Explicitly list fields to use camelCase names for frontend
        fields = ['id', 'name', 'notes', 'bodyweight', 'startedAt', 'endedAt', 'user', 'preset', 'sets']


class SupersetExerciseItemSerializer(serializers.ModelSerializer):
    exerciseId = serializers.ReadOnlyField(source='exercise.id')
    includeWarmup = serializers.ReadOnlyField(source='include_warmup')

    class Meta:
        model = SupersetExerciseItem
        fields = ['id', 'exerciseId', 'type', 'dropdowns', 'includeWarmup', 'order']


class WorkoutPresetExerciseSerializer(serializers.ModelSerializer):
    exerciseId = serializers.ReadOnlyField(source='exercise.id')
    exerciseName = serializers.ReadOnlyField(source='exercise.name')
    includeWarmup = serializers.ReadOnlyField(source='include_warmup')
    supersetExercises = SupersetExerciseItemSerializer(
        many=True, read_only=True, source='superset_exercises'
    )

    class Meta:
        model = WorkoutPresetExercise
        fields = ['id', 'exerciseId', 'exerciseName', 'type', 'sets', 'dropdowns', 'includeWarmup', 'order', 'supersetExercises']


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
    dayLabel = serializers.CharField(source='day_label', required=False, allow_blank=True, allow_null=True)
    status = serializers.CharField(read_only=True)
    lastUsedWeights = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutPreset
        fields = ['id', 'user_id', 'user', 'name', 'notes', 'status', 'dayLabel', 'tags', 'is_public', 'created_at', 'updated_at', 'exercises', 'lastUsedWeights']

    def get_lastUsedWeights(self, obj):
        """Get last used weights for exercises in this preset."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return {}

        from users.models import ExerciseSettings

        # Get all exercise IDs in this preset
        exercise_ids = []
        for ex in obj.exercises.all():
            if ex.exercise:
                exercise_ids.append(ex.exercise_id)
            # Also include superset exercises
            for sup_ex in ex.superset_exercises.all():
                if sup_ex.exercise:
                    exercise_ids.append(sup_ex.exercise_id)

        if not exercise_ids:
            return {}

        # Get last used settings for these exercises
        settings = ExerciseSettings.objects.filter(
            user=request.user,
            exercise_id__in=exercise_ids
        ).select_related('exercise')

        result = {}
        for setting in settings:
            data = {'reps': setting.reps}
            if setting.weight is not None:
                data['weight'] = setting.weight
            if setting.sub_sets:
                data['subSets'] = setting.sub_sets
            result[setting.exercise_id] = data  # Use numeric key for frontend

        return result

    def create(self, validated_data):
        """Handle creating preset with nested exercises."""
        # Extract exercises data from context (not in validated_data due to read_only)
        exercises_data = self.context.get('exercises_data', [])

        # Create the preset without exercises first
        # Note: user is already in validated_data (passed from perform_create)
        preset = WorkoutPreset.objects.create(**validated_data)

        # Create exercises for the preset
        for ex_data in exercises_data:
            exercise_id = ex_data.get('exerciseId')
            exercise_type = ex_data.get('type', 'normal')

            if exercise_type == 'superset':
                # Create superset exercise with nested items
                superset_ex = WorkoutPresetExercise.objects.create(
                    preset=preset,
                    exercise_id=None,  # Supersets don't have a single exercise
                    type='superset',
                    sets=ex_data.get('sets', 3),
                    order=ex_data.get('order', 0)
                )

                # Create nested superset items
                superset_items_data = ex_data.get('supersetExercises', [])
                for item_data in superset_items_data:
                    SupersetExerciseItem.objects.create(
                        superset=superset_ex,
                        exercise_id=item_data.get('exerciseId'),
                        type=item_data.get('type', 'normal'),
                        dropdowns=item_data.get('dropdowns'),
                        include_warmup=item_data.get('includeWarmup', False),
                        order=item_data.get('order', 0)
                    )
            elif exercise_id:
                # Create normal exercise
                WorkoutPresetExercise.objects.create(
                    preset=preset,
                    exercise_id=exercise_id,
                    type=exercise_type,
                    sets=ex_data.get('sets', 3),
                    dropdowns=ex_data.get('dropdowns'),
                    include_warmup=ex_data.get('includeWarmup', False),
                    order=ex_data.get('order', 0)
                )

        return preset

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
