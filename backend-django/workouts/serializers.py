from django.db import transaction
from django.db.models import Max, Q
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


class DropdownWeightSerializer(serializers.Serializer):
    weight = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        min_value=0,
        allow_null=True,
        required=False,
        coerce_to_string=False,
    )
    reps = serializers.IntegerField(min_value=0, required=False, default=0)


class DropdownWeightsField(serializers.JSONField):
    """Restrict persisted drop-set payloads to bounded numeric rows."""

    def __init__(self, **kwargs):
        kwargs.setdefault('allow_null', True)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if value is None:
            return None
        if not isinstance(value, list):
            raise serializers.ValidationError('Must be a list of drop sets')
        if len(value) > 20:
            raise serializers.ValidationError('Too many drop sets')
        serializer = DropdownWeightSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return [
            {
                'weight': None if row.get('weight') is None else float(row['weight']),
                'reps': row.get('reps', 0),
            }
            for row in serializer.validated_data
        ]


class WorkoutSetUpdateSerializer(serializers.Serializer):
    weight = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        min_value=0,
        allow_null=True,
        required=False,
        coerce_to_string=False,
    )
    reps = serializers.IntegerField(
        min_value=0,
        max_value=10000,
        allow_null=True,
        required=False,
    )
    dropdownWeights = DropdownWeightsField(required=False)


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
    class AccessibleExercisePrimaryKeyField(serializers.PrimaryKeyRelatedField):
        def get_queryset(self):
            request = self.context.get('request')
            if request is None or not getattr(request.user, 'is_authenticated', False):
                return Exercise.objects.none()
            return Exercise.objects.filter(
                Q(user=request.user) | Q(user__isnull=True)
            )

    exerciseId = AccessibleExercisePrimaryKeyField(source='exercise')
    exerciseName = serializers.ReadOnlyField(source='exercise.name')  # Include exercise name for fallback matching
    set_order = serializers.IntegerField(required=False, min_value=0, max_value=10000)
    # Use a custom method field to ensure loggedAt is always included
    loggedAt = serializers.SerializerMethodField()
    dropdownWeights = DropdownWeightsField(source='dropdown_weights', required=False)
    setType = serializers.ChoiceField(choices=WorkoutSet.SET_TYPES, source='set_type')
    # Return weight as a number (not string) - use Decimal with coerce_to_string=False
    weight = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        min_value=0,
        allow_null=True,
        required=False,
        coerce_to_string=False,
    )
    reps = serializers.IntegerField(min_value=0, max_value=10000, allow_null=True, required=False)

    def validate_session(self, value):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not getattr(user, 'is_authenticated', False) or value.user_id != user.id:
            raise serializers.ValidationError('Invalid session')
        return value

    def create(self, validated_data):
        if 'set_order' not in validated_data:
            last_order = validated_data['session'].sets.aggregate(
                Max('set_order')
            )['set_order__max']
            validated_data['set_order'] = 0 if last_order is None else last_order + 1
        return super().create(validated_data)

    def get_loggedAt(self, obj):
        """Always return completed_at, even if None."""
        return obj.completed_at

    class Meta:
        model = WorkoutSet
        # Use camelCase for frontend
        fields = ['id', 'exerciseId', 'exerciseName', 'session', 'set_order', 'setType', 'weight', 'reps', 'dropdownWeights', 'loggedAt']


class WorkoutSessionSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    preset = serializers.PrimaryKeyRelatedField(read_only=True)
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
    user = serializers.PrimaryKeyRelatedField(read_only=True)
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

    def _resolve_visible_exercise(self, exercise_id):
        """Resolve an exercise without allowing private cross-user references."""
        if exercise_id is None or isinstance(exercise_id, bool):
            return None
        try:
            pk = int(exercise_id)
        except (TypeError, ValueError):
            return None
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None or not getattr(user, 'is_authenticated', False):
            return None
        return Exercise.objects.filter(
            Q(user=user) | Q(user__isnull=True),
            pk=pk,
        ).first()

    @staticmethod
    def _validate_nonnegative_int(value):
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            return None
        return value

    @staticmethod
    def _validate_positive_int(value):
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            return None
        return value

    def _validate_superset_item(self, item_data, location):
        if not isinstance(item_data, dict):
            raise serializers.ValidationError({"exercises": [f"{location} must be an object"]})

        item_type = item_data.get("type", "normal")
        if item_type not in {"normal", "dropdown"}:
            raise serializers.ValidationError({"exercises": [f"{location} has an invalid type"]})

        dropdowns = item_data.get("dropdowns")
        if dropdowns is not None:
            dropdowns = self._validate_nonnegative_int(dropdowns)
            if dropdowns is None:
                raise serializers.ValidationError({"exercises": [f"{location} has an invalid dropdown count"]})
        elif item_type == "dropdown":
            raise serializers.ValidationError({"exercises": [f"{location} must have a non-negative dropdown count"]})

        include_warmup = item_data.get("includeWarmup", False)
        if not isinstance(include_warmup, bool):
            raise serializers.ValidationError({"exercises": [f"{location} has an invalid warmup flag"]})

        order = self._validate_nonnegative_int(item_data.get("order"))
        if order is None:
            raise serializers.ValidationError({"exercises": [f"{location} has an invalid order"]})

        exercise = self._resolve_visible_exercise(item_data.get("exerciseId"))
        if exercise is None:
            raise serializers.ValidationError({"exercises": [f"{location} references an invalid or unavailable exercise"]})

        return {
            "type": item_type,
            "dropdowns": dropdowns,
            "includeWarmup": include_warmup,
            "order": order,
            "_exercise": exercise,
        }

    @staticmethod
    def _references_private_exercise(exercises_data):
        for exercise_data in exercises_data:
            exercise = exercise_data.get("_exercise")
            if exercise is not None and exercise.user_id is not None:
                return True
            for item in exercise_data.get("supersetExercises", []):
                if item["_exercise"].user_id is not None:
                    return True
        return False

    def validate(self, attrs):
        raw_exercises = self.context.get("exercises_data")
        if raw_exercises is None and self.instance is not None:
            self.context["validated_exercises"] = None
            return attrs
        if raw_exercises is None:
            raw_exercises = []
        if not isinstance(raw_exercises, list):
            raise serializers.ValidationError({"exercises": ["Must be a list of exercise objects"]})

        validated_exercises = []
        seen_row_ids = set()
        for index, item_data in enumerate(raw_exercises):
            location = f"exercises[{index}]"
            if not isinstance(item_data, dict):
                raise serializers.ValidationError({"exercises": [f"{location} must be an object"]})

            item_type = item_data.get("type", "normal")
            if item_type not in {"normal", "dropdown", "superset"}:
                raise serializers.ValidationError({"exercises": [f"{location} has an invalid type"]})

            sets = self._validate_positive_int(item_data.get("sets", 3))
            if sets is None:
                raise serializers.ValidationError({"exercises": [f"{location} must have a positive number of sets"]})

            dropdowns = item_data.get("dropdowns")
            if dropdowns is not None:
                dropdowns = self._validate_nonnegative_int(dropdowns)
                if dropdowns is None:
                    raise serializers.ValidationError({"exercises": [f"{location} has an invalid dropdown count"]})
            elif item_type == "dropdown":
                raise serializers.ValidationError({"exercises": [f"{location} must have a non-negative dropdown count"]})

            include_warmup = item_data.get("includeWarmup", False)
            if not isinstance(include_warmup, bool):
                raise serializers.ValidationError({"exercises": [f"{location} has an invalid warmup flag"]})

            order = item_data.get("order")
            if order is None:
                order = index
            else:
                order = self._validate_nonnegative_int(order)
                if order is None:
                    raise serializers.ValidationError({"exercises": [f"{location} has an invalid order"]})

            validated_item = {
                "type": item_type,
                "sets": sets,
                "dropdowns": dropdowns,
                "includeWarmup": include_warmup,
                "order": order,
            }

            # Database rows use stable IDs; the client uses temporary numeric IDs
            # for rows it has added locally. Ignore those IDs on write.
            row_id = item_data.get("id")
            normalized_row_id = None
            try:
                if row_id is not None and not isinstance(row_id, bool):
                    candidate = float(row_id)
                    if candidate.is_integer():
                        normalized_row_id = int(candidate)
            except (TypeError, ValueError, OverflowError):
                normalized_row_id = None

            if normalized_row_id is not None and self.instance is not None:
                if self.instance.exercises.filter(pk=normalized_row_id).exists():
                    if normalized_row_id in seen_row_ids:
                        raise serializers.ValidationError({"exercises": [f"{location} contains a duplicate exercise row ID"]})
                    seen_row_ids.add(normalized_row_id)
                    validated_item["_id"] = normalized_row_id

            if item_type == "superset":
                raw_items = item_data.get("supersetExercises")
                if not isinstance(raw_items, list) or not raw_items:
                    raise serializers.ValidationError({"exercises": [f"{location} must contain at least one superset exercise"]})
                validated_item["supersetExercises"] = [
                    self._validate_superset_item(superset_item, f"{location}.supersetExercises[{item_index}]")
                    for item_index, superset_item in enumerate(raw_items)
                ]
            else:
                exercise = self._resolve_visible_exercise(item_data.get("exerciseId"))
                if exercise is None:
                    raise serializers.ValidationError({"exercises": [f"{location} references an invalid or unavailable exercise"]})
                validated_item["_exercise"] = exercise

            validated_exercises.append(validated_item)

        desired_is_public = attrs.get(
            "is_public",
            self.instance.is_public if self.instance else False,
        )
        if desired_is_public and self._references_private_exercise(validated_exercises):
            raise serializers.ValidationError({
                "exercises": ["Public presets cannot contain private exercises"],
            })

        self.context["validated_exercises"] = validated_exercises
        return attrs

    def create(self, validated_data):
        """Handle creating preset with nested exercises."""
        # Validation resolves these to exercises the current user may reference.
        exercises_data = self.context.get('validated_exercises', [])

        # Create the preset without exercises first
        # Note: user is already in validated_data (passed from perform_create)
        with transaction.atomic():
            preset = WorkoutPreset.objects.create(**validated_data)

            for ex_data in exercises_data:
                exercise_type = ex_data['type']

                if exercise_type == 'superset':
                    superset_ex = WorkoutPresetExercise.objects.create(
                        preset=preset,
                        exercise=None,
                        type='superset',
                        sets=ex_data['sets'],
                        dropdowns=ex_data['dropdowns'],
                        include_warmup=ex_data['includeWarmup'],
                        order=ex_data['order'],
                    )
                    SupersetExerciseItem.objects.bulk_create([
                        SupersetExerciseItem(
                            superset=superset_ex,
                            exercise=item_data['_exercise'],
                            type=item_data['type'],
                            dropdowns=item_data['dropdowns'],
                            include_warmup=item_data['includeWarmup'],
                            order=item_data['order'],
                        )
                        for item_data in ex_data['supersetExercises']
                    ])
                else:
                    WorkoutPresetExercise.objects.create(
                        preset=preset,
                        exercise=ex_data['_exercise'],
                        type=exercise_type,
                        sets=ex_data['sets'],
                        dropdowns=ex_data['dropdowns'],
                        include_warmup=ex_data['includeWarmup'],
                        order=ex_data['order'],
                    )

        return preset

    def update(self, instance, validated_data):
        """Handle updating nested exercises."""
        # A missing exercises key leaves the existing nested rows untouched.
        exercises_data = self.context.get('validated_exercises')
        if exercises_data is not None:
            existing_exercises = {ex.id: ex for ex in instance.exercises.all()}
            with transaction.atomic():
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                instance.save()

                retained_row_ids = set()
                for ex_data in exercises_data:
                    row_id = ex_data.get('_id')
                    if row_id in existing_exercises:
                        retained_row_ids.add(row_id)
                        preset_exercise = existing_exercises[row_id]
                        preset_exercise.type = ex_data['type']
                        preset_exercise.sets = ex_data['sets']
                        preset_exercise.dropdowns = ex_data['dropdowns']
                        preset_exercise.include_warmup = ex_data['includeWarmup']
                        preset_exercise.order = ex_data['order']
                        preset_exercise.exercise = (
                            ex_data['_exercise'] if ex_data['type'] != 'superset' else None
                        )
                        preset_exercise.save()

                        # Replacing a row clears its children whether it stays a
                        # superset or converts between row types.
                        preset_exercise.superset_exercises.all().delete()
                        if ex_data['type'] == 'superset':
                            SupersetExerciseItem.objects.bulk_create([
                                SupersetExerciseItem(
                                    superset=preset_exercise,
                                    exercise=item_data['_exercise'],
                                    type=item_data['type'],
                                    dropdowns=item_data['dropdowns'],
                                    include_warmup=item_data['includeWarmup'],
                                    order=item_data['order'],
                                )
                                for item_data in ex_data['supersetExercises']
                            ])
                    elif ex_data['type'] == 'superset':
                        preset_exercise = WorkoutPresetExercise.objects.create(
                            preset=instance,
                            exercise=None,
                            type='superset',
                            sets=ex_data['sets'],
                            dropdowns=ex_data['dropdowns'],
                            include_warmup=ex_data['includeWarmup'],
                            order=ex_data['order'],
                        )
                        SupersetExerciseItem.objects.bulk_create([
                            SupersetExerciseItem(
                                superset=preset_exercise,
                                exercise=item_data['_exercise'],
                                type=item_data['type'],
                                dropdowns=item_data['dropdowns'],
                                include_warmup=item_data['includeWarmup'],
                                order=item_data['order'],
                            )
                            for item_data in ex_data['supersetExercises']
                        ])
                    else:
                        WorkoutPresetExercise.objects.create(
                            preset=instance,
                            exercise=ex_data['_exercise'],
                            type=ex_data['type'],
                            sets=ex_data['sets'],
                            dropdowns=ex_data['dropdowns'],
                            include_warmup=ex_data['includeWarmup'],
                            order=ex_data['order'],
                        )

                removed_row_ids = set(existing_exercises) - retained_row_ids
                if removed_row_ids:
                    instance.exercises.filter(pk__in=removed_row_ids).delete()

            # Nested rows were prefetched before mutations; force the response
            # serializer to read the post-transaction state.
            instance._prefetched_objects_cache = {}
        else:
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
class ExerciseIdentifierField(serializers.CharField):
    """Preserve caller IDs while rejecting complex or oversized values."""

    def to_internal_value(self, data):
        if isinstance(data, bool) or not isinstance(data, (str, int)):
            self.fail('invalid')
        value = super().to_internal_value(str(data)).strip()
        if not value:
            self.fail('blank')
        return data if isinstance(data, int) else value


class VolumeSetSerializer(serializers.Serializer):
    weight_lbs = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        min_value=0,
        coerce_to_string=False,
        default=0,
    )
    reps = serializers.IntegerField(min_value=0, max_value=10000, default=0)
    exercise_id = ExerciseIdentifierField(required=False, default="unknown", max_length=100)


class VolumeCalculationRequestSerializer(serializers.Serializer):
    """Request serializer for volume calculation endpoint"""
    sets = serializers.ListField(
        child=VolumeSetSerializer(),
        max_length=10000,
        required=False,
        default=list,
        help_text="List of sets with weight_lbs, reps, and exercise_id"
    )


class VolumeCalculationResponseSerializer(serializers.Serializer):
    """Response serializer for volume calculation endpoint"""
    total_volume = serializers.FloatField()
    volume_by_exercise = serializers.DictField()
