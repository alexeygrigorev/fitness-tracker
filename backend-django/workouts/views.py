from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from datetime import datetime
from decimal import Decimal, InvalidOperation
from django.db.models import Prefetch, Q
from django.http import Http404
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from .models import (
    Exercise, WorkoutSession, WorkoutSet, WorkoutPreset,
    WorkoutPresetExercise, WorkoutPlan, WorkoutPlanPreset, SupersetExerciseItem
)
from .services import generate_sets_from_preset
from .serializers import (
    ExerciseSerializer, WorkoutSetSerializer, WorkoutSessionSerializer,
    WorkoutPresetSerializer, WorkoutPlanSerializer,
    VolumeCalculationRequestSerializer, VolumeCalculationResponseSerializer,
    WorkoutSetUpdateSerializer,
)


def _validated_set_updates(request):
    payload = {
        key: request.data[key]
        for key in ('weight', 'reps', 'dropdownWeights')
        if key in request.data
    }
    serializer = WorkoutSetUpdateSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    validated = serializer.validated_data
    updates = {}
    if 'weight' in validated:
        updates['weight'] = validated['weight']
    if 'reps' in validated:
        updates['reps'] = validated['reps']
    if 'dropdownWeights' in validated:
        updates['dropdown_weights'] = validated['dropdownWeights']
    return updates

def model_to_dict(instance):
    """Convert model instance to dict, handling related objects and date formatting."""
    result = {}
    for k, v in instance.__dict__.items():
        if k.startswith("_"):
            continue
        # Convert datetime to ISO format string
        if hasattr(v, 'isoformat'):
            result[k] = v.isoformat()
        else:
            result[k] = v

    # For WorkoutSession, add related sets and map field names to frontend format
    if hasattr(instance, 'sets'):
        result['sets'] = [
            {
                'id': s.id,
                'exerciseId': s.exercise_id,
                'setType': s.set_type,
                'weight': float(s.weight) if s.weight else None,
                'reps': s.reps,
                'dropdownWeights': s.dropdown_weights,
                'set_order': s.set_order,
                'loggedAt': s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in instance.sets.all()
        ]

    # Map Django field names to frontend names for WorkoutSession
    if instance.__class__.__name__ == 'WorkoutSession':
        if 'created_at' in result:
            result['startedAt'] = result.pop('created_at')
        if 'finished_at' in result:
            result['endedAt'] = result.pop('finished_at')

    # Map Django field names to frontend names for WorkoutSet
    if instance.__class__.__name__ == 'WorkoutSet':
        result['exerciseId'] = result.pop('exercise_id')
        result['setType'] = result.pop('set_type')
        result['dropdownWeights'] = result.pop('dropdown_weights')
        result['loggedAt'] = result.pop('completed_at')
        # Remove session and exercise FKs from response (not needed by frontend)
        result.pop('session', None)
        result.pop('exercise', None)

    return result


def is_exercise_visible(exercise, user):
    """Private exercises are usable only by their owner."""
    return exercise.user_id is None or exercise.user_id == user.id


def get_visible_exercise(exercise_id, user):
    """Resolve an exercise without leaking IDs owned by another user."""
    if exercise_id is None:
        return None
    try:
        exercise = Exercise.objects.get(pk=exercise_id)
    except (Exercise.DoesNotExist, TypeError, ValueError):
        return None
    return exercise if is_exercise_visible(exercise, user) else None


def preset_has_hidden_exercises(preset, user):
    """Reject shared presets that embed references a caller cannot see."""
    for preset_exercise in preset.exercises.all():
        if preset_exercise.type != "superset":
            exercise = preset_exercise.exercise
            if exercise is None or not is_exercise_visible(exercise, user):
                return True
            continue
        for item in preset_exercise.superset_exercises.all():
            if not is_exercise_visible(item.exercise, user):
                return True
    return False


def user_can_access_preset(preset, user):
    """Own, common/template, and explicitly public presets are readable."""
    return (
        preset.user_id is None
        or preset.user_id == user.id
        or preset.is_public
    )


def _parse_datetime(value):
    """Normalize client ISO timestamps while rejecting non-date scalars."""
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if not isinstance(value, datetime):
        raise ValueError("Invalid datetime")
    return value


def _decimal_value(value):
    """Coerce JSON numbers/strings to the model's two-decimal precision."""
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Invalid decimal")
    try:
        number = Decimal(str(value)).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid decimal")
    if not number.is_finite() or number.adjusted() + 1 > 4:
        raise ValueError("Invalid decimal")
    return number


def _integer_value(value):
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Invalid integer")
    try:
        if isinstance(value, float) and not value.is_integer():
            raise ValueError("Invalid integer")
        return int(value)
    except (TypeError, ValueError):
        raise ValueError("Invalid integer")


def copy_preset_for_user(template, user):
    """Copy a validated preset and its nested rows atomically."""
    with transaction.atomic():
        new_preset = WorkoutPreset.objects.create(
            user=user,
            name=template.name,
            notes=template.notes,
        )

        preset_exercises = template.exercises.prefetch_related(
            'superset_exercises__exercise'
        ).order_by('order')
        for preset_ex in preset_exercises:
            new_preset_ex = WorkoutPresetExercise.objects.create(
                preset=new_preset,
                exercise=preset_ex.exercise,
                type=preset_ex.type,
                sets=preset_ex.sets,
                dropdowns=preset_ex.dropdowns,
                include_warmup=preset_ex.include_warmup,
                order=preset_ex.order,
            )
            if preset_ex.type == "superset":
                SupersetExerciseItem.objects.bulk_create([
                    SupersetExerciseItem(
                        superset=new_preset_ex,
                        exercise=sup_item.exercise,
                        type=sup_item.type,
                        dropdowns=sup_item.dropdowns,
                        include_warmup=sup_item.include_warmup,
                        order=sup_item.order,
                    )
                    for sup_item in preset_ex.superset_exercises.all()
                ])

    return new_preset


class ExerciseViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Exercise.objects.filter(user__isnull=True)
        return (
            Exercise.objects.filter(user=self.request.user)
            | Exercise.objects.filter(user__isnull=True)
        ).prefetch_related('muscle_groups', 'equipment')

    serializer_class = ExerciseSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # User-created exercises are always owned by the user
        serializer.save(user=self.request.user)

    def _get_exercise_for_write(self, pk):
        """Resolve outside the visible queryset so denied writes return 403."""
        try:
            return Exercise.objects.get(pk=pk)
        except (Exercise.DoesNotExist, TypeError, ValueError):
            raise Http404

    def _authorize_exercise_write(self, exercise, *, deleting=False):
        verb = "delete" if deleting else "modify"
        if exercise.user_id is None:
            return Response({"error": f"Cannot {verb} common exercises"}, status=403)
        if exercise.user_id != self.request.user.id:
            return Response(
                {"error": f"Cannot {verb} exercises created by another user"},
                status=403,
            )
        return None

    def update(self, request, *args, **kwargs):
        obj = self._get_exercise_for_write(kwargs.get("pk"))
        error = self._authorize_exercise_write(obj)
        if error is not None:
            return error
        serializer = self.get_serializer(obj, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        obj = self._get_exercise_for_write(kwargs.get("pk"))
        error = self._authorize_exercise_write(obj)
        if error is not None:
            return error
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        obj = self._get_exercise_for_write(kwargs.get("pk"))
        error = self._authorize_exercise_write(obj, deleting=True)
        if error is not None:
            return error
        obj.delete()
        return Response(status=204)


class WorkoutSetViewSet(viewsets.ModelViewSet):
    """ViewSet for managing individual workout sets (marking complete, updating weight/reps)."""
    serializer_class = WorkoutSetSerializer
    
    def get_queryset(self):
        return WorkoutSet.objects.filter(session__user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        return Response(model_to_dict(self.get_object()))

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Mark a set as completed with current timestamp. Also updates weight/reps if provided."""
        obj = self.get_object()
        from django.utils import timezone

        for field_name, value in _validated_set_updates(request).items():
            setattr(obj, field_name, value)

        # Then mark as complete
        obj.completed_at = timezone.now()
        obj.save()
        # Use serializer for response to get correct field names (loggedAt instead of completed_at)
        serializer = WorkoutSetSerializer(obj)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def uncomplete(self, request, pk=None):
        """Mark a set as not completed by clearing completed_at."""
        obj = self.get_object()
        obj.completed_at = None
        obj.save()
        # Use serializer for response to get correct field names (loggedAt instead of completed_at)
        serializer = WorkoutSetSerializer(obj)
        return Response(serializer.data)


class WorkoutSessionViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSessionSerializer

    def get_queryset(self):
        return WorkoutSession.objects.filter(user=self.request.user).prefetch_related('sets__exercise')

    def list(self, request, *args, **kwargs):
        # Use serializer to get camelCase field names and include related sets
        queryset = self.get_queryset()
        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        serializer = self.serializer_class(obj)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if not isinstance(data, dict):
            return Response({"error": "Invalid workout"}, status=400)

        # Extract sets data before creating session (sets can't be directly assigned)
        sets_data = data.pop('sets', None)
        if sets_data is not None and (
            not isinstance(sets_data, list)
            or any(not isinstance(set_data, dict) for set_data in sets_data)
        ):
            return Response({"error": "Invalid sets"}, status=400)

        try:
            # Parse ISO format datetimes sent by JavaScript clients.
            if 'startedAt' in data:
                started_at = data.pop('startedAt')
                data['created_at'] = _parse_datetime(started_at)
            if 'created_at' not in data or data.get('created_at') is None:
                data['created_at'] = timezone.now()
            if 'endedAt' in data:
                ended_at = data.pop('endedAt')
                data['finished_at'] = _parse_datetime(ended_at)

            name = data.get('name')
            notes = data.get('notes')
            if (name is not None and not isinstance(name, str)) or (
                notes is not None and not isinstance(notes, str)
            ):
                raise ValueError("Invalid text")
            data['bodyweight'] = _decimal_value(data.get('bodyweight'))
        except (TypeError, ValueError):
            return Response({"error": "Invalid date"}, status=400)

        preset = None
        preset_id = data.get('preset_id', data.get('preset'))
        if preset_id is not None:
            preset = WorkoutPreset.objects.filter(
                pk=preset_id,
            ).filter(
                Q(user=request.user) | Q(user__isnull=True) | Q(is_public=True)
            ).first()
            if preset is None:
                return Response({"error": "Preset not found"}, status=404)
            if preset_has_hidden_exercises(preset, request.user):
                return Response(
                    {"error": "Preset contains an unavailable exercise"},
                    status=403,
                )

        try:
            with transaction.atomic():
                obj = WorkoutSession.objects.create(
                    user=request.user,
                    name=data.get('name') or 'Workout',
                    notes=data.get('notes'),
                    bodyweight=data.get('bodyweight'),
                    created_at=data['created_at'],
                    finished_at=data.get('finished_at'),
                    preset=preset,
                )

                sets_to_create = []
                for index, set_data in enumerate(sets_data or []):
                    exercise_id = set_data.get('exerciseId', set_data.get('exercise_id'))
                    exercise = get_visible_exercise(exercise_id, request.user)
                    if exercise is None:
                        raise ValidationError({"sets": "Invalid or unavailable exercise"})

                    set_order = _integer_value(set_data.get('set_order', index))
                    if set_order is None or set_order < 0:
                        raise ValueError("Invalid set order")

                    set_type = set_data.get(
                        'setType', set_data.get('set_type', 'normal')
                    )
                    if set_type not in {choice for choice, _ in WorkoutSet.SET_TYPES}:
                        raise ValueError("Invalid set type")

                    sets_to_create.append(WorkoutSet(
                        session=obj,
                        set_order=set_order,
                        exercise=exercise,
                        set_type=set_type,
                        weight=_decimal_value(set_data.get('weight')),
                        reps=_integer_value(set_data.get('reps')),
                        dropdown_weights=set_data.get('dropdownWeights', set_data.get('dropdown_weights')),
                        completed_at=_parse_datetime(set_data.get('loggedAt')),
                    ))

                WorkoutSet.objects.bulk_create(sets_to_create)
        except (ValueError, ValidationError):
            return Response({"error": "Invalid date or numeric value"}, status=400)

        # Use serializer to include sets in the response
        serializer = self.serializer_class(obj)
        return Response(serializer.data, status=201)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"])
    def finish(self, request, pk=None):
        """Mark the workout session as finished."""
        from django.utils import timezone
        obj = self.get_object()
        obj.finished_at = timezone.now()
        obj.save()
        # Use serializer to ensure all fields are included
        serializer = WorkoutSessionSerializer(obj)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="sets/(?P<set_id>[^/.]+)")
    def complete_set(self, request, pk=None, set_id=None):
        """Complete a set and optionally update weight/reps.
        URL: PATCH /api/workouts/sessions/{session_id}/sets/{set_id}/

        Body: { weight?, reps?, dropdownWeights? }
        Sets completed_at to now() and updates any provided fields.
        """
        from django.utils import timezone

        # Get the set directly, verifying it belongs to this session
        try:
            workout_set = WorkoutSet.objects.get(
                pk=set_id,
                session_id=pk,
                session__user=request.user,
            )
        except WorkoutSet.DoesNotExist:
            return Response({"error": "Set not found in this session"}, status=404)

        for field_name, value in _validated_set_updates(request).items():
            setattr(workout_set, field_name, value)

        # Mark as complete
        workout_set.completed_at = timezone.now()
        workout_set.save()

        serializer = WorkoutSetSerializer(workout_set)
        return Response(serializer.data)

    @action(detail=True, methods=["delete"], url_path="sets/(?P<set_id>[^/.]+)/completion")
    def uncomplete_set(self, request, pk=None, set_id=None):
        """Uncomplete a set (clear completed_at).
        URL: DELETE /api/workouts/sessions/{session_id}/sets/{set_id}/completion/
        """
        # Get the set directly, verifying it belongs to this session
        try:
            workout_set = WorkoutSet.objects.get(
                pk=set_id,
                session_id=pk,
                session__user=request.user,
            )
        except WorkoutSet.DoesNotExist:
            return Response({"error": "Set not found in this session"}, status=404)

        # Clear completion
        workout_set.completed_at = None
        workout_set.save()

        serializer = WorkoutSetSerializer(workout_set)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get all active workout sessions (workouts that are not finished yet)."""
        # Return all workout sessions that don't have finished_at
        active_sessions = WorkoutSession.objects.filter(
            user=request.user,
            finished_at__isnull=True
        ).order_by('-created_at')

        serializer = WorkoutSessionSerializer(active_sessions, many=True)
        return Response(serializer.data)


class WorkoutPresetViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutPresetSerializer

    def get_queryset(self):
        # For list action, only return user's own presets (prefetch exercises for performance)
        if self.action == "list":
            return WorkoutPreset.objects.filter(user=self.request.user).prefetch_related(
                'exercises__exercise', 'exercises__superset_exercises__exercise'
            )
        # For detail actions, allow accessing any preset (permissions checked in action methods)
        return WorkoutPreset.objects.all().prefetch_related(
            'exercises__exercise', 'exercises__superset_exercises__exercise'
        )

    def get_permissions(self):
        # Allow anyone to access templates endpoint
        if self.action == "templates":
            return [AllowAny()]
        return super().get_permissions()

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        # Only allow retrieving own presets or templates/public presets
        if obj.user_id != request.user.id and obj.user is not None and not obj.is_public:
            return Response({"error": "Not found"}, status=404)
        if preset_has_hidden_exercises(obj, request.user):
            return Response({"error": "Not found"}, status=404)
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

    def _require_owned_preset(self, request):
        obj = self.get_object()
        if obj.user is None:
            return None, Response({"error": "Cannot modify template presets"}, status=403)
        if obj.user_id != request.user.id:
            return None, Response({"error": "Cannot modify presets created by another user"}, status=403)
        return obj, None

    def update(self, request, *args, **kwargs):
        _, error = self._require_owned_preset(request)
        if error is not None:
            return error

        obj = self.get_object()
        serializer = self.get_serializer(obj, data=request.data)
        serializer.context['exercises_data'] = request.data.get('exercises')
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Create a new preset with exercises."""
        # Extract exercises data to pass to serializer for manual handling
        exercises_data = request.data.get('exercises', [])

        # Create serializer with exercises_data in context
        serializer = self.get_serializer(data=request.data)
        serializer.context['exercises_data'] = exercises_data
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=201, headers=headers)

    def perform_create(self, serializer):
        # Set the user to the current user when creating
        serializer.save(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        obj, error = self._require_owned_preset(request)
        if error is not None:
            return error

        # Extract exercises data to pass to serializer for manual handling
        exercises_data = request.data.get('exercises')
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.context['exercises_data'] = exercises_data
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        # Template presets (user=None) cannot be deleted
        if obj.user is None:
            return Response({"error": "Cannot delete template presets"}, status=403)
        # User presets can only be deleted by their owner
        if obj.user_id != request.user.id:
            return Response({"error": "Cannot delete presets created by another user"}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def templates(self, request):
        """List all template presets (user=None or is_public=True)."""
        templates = WorkoutPreset.objects.filter(
            Q(user=None) | Q(is_public=True)
        ).prefetch_related('exercises__exercise', 'exercises__superset_exercises__exercise')
        templates = [
            preset for preset in templates
            if not preset_has_hidden_exercises(preset, request.user)
        ]
        serializer = self.get_serializer(templates, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def create_from_template(self, request):
        """Create a new preset from a template or another user's public preset."""
        template_id = request.data.get("template_id")
        if not template_id:
            return Response({"error": "template_id is required"}, status=400)

        try:
            template = WorkoutPreset.objects.get(id=template_id)
        except WorkoutPreset.DoesNotExist:
            return Response({"error": "Template not found"}, status=404)

        # Check if the preset can be copied
        can_copy = (
            template.user is None or  # Template (no user)
            template.is_public or  # Public preset
            template.user_id == request.user.id  # Own preset
        )
        if not can_copy:
            return Response({"error": "Cannot copy private preset from another user"}, status=403)
        if preset_has_hidden_exercises(template, request.user):
            return Response({"error": "Template contains an unavailable exercise"}, status=403)

        new_preset = copy_preset_for_user(template, request.user)

        serializer = self.get_serializer(new_preset)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=["post"])
    def start_workout(self, request, pk=None):
        """Create a WorkoutSession from this preset with all sets.
        Accepts optional 'startedAt' and 'bodyweight' parameters.
        Allows multiple active workouts (does not auto-finish existing workouts).
        """
        from .serializers import WorkoutSessionSerializer, WorkoutSetSerializer

        preset = self.get_object()
        if not user_can_access_preset(preset, request.user):
            return Response({"error": "Preset not found"}, status=404)
        if preset_has_hidden_exercises(preset, request.user):
            return Response({"error": "Preset contains an unavailable exercise"}, status=403)

        # Get client-provided start time if available, otherwise use server time
        started_at = request.data.get('startedAt')
        try:
            created_time = _parse_datetime(started_at)
            if created_time is None:
                created_time = timezone.now()
            bodyweight = _decimal_value(request.data.get('bodyweight'))
        except (TypeError, ValueError):
            return Response({"error": "Invalid date"}, status=400)

        try:
            with transaction.atomic():
                session = WorkoutSession.objects.create(
                    user=request.user,
                    preset=preset,
                    name=preset.name,
                    notes=preset.notes,
                    bodyweight=bodyweight,
                    created_at=created_time,
                )

                preset_exercises = list(preset.exercises.prefetch_related(
                    "superset_exercises__exercise"
                ).order_by("order"))
                sets = generate_sets_from_preset(preset_exercises, session)
                WorkoutSet.objects.bulk_create(sets)
        except (ValueError, ValidationError):
            return Response(
                {"error": "Unable to create workout from preset"},
                status=400,
            )

        # Fetch the session from the database with its sets (refresh_from_db doesn't use prefetch_related)
        session = WorkoutSession.objects.filter(
            user=request.user,
            pk=session.pk
        ).prefetch_related('sets__exercise').first()

        # Use serializers to get camelCase field names for frontend
        session_serializer = WorkoutSessionSerializer(session)
        # The session serializer includes nested sets, but frontend also expects sets at top level
        # Extract the properly serialized sets from the session
        sets_data = session_serializer.data.get('sets', [])

        return Response({
            "session": {
                "id": session_serializer.data.get('id'),
                "name": session_serializer.data.get('name'),
                "notes": session_serializer.data.get('notes'),
                "bodyweight": session_serializer.data.get('bodyweight'),
                "startedAt": session_serializer.data.get('startedAt'),
                "endedAt": session_serializer.data.get('endedAt'),
                "user_id": session_serializer.data.get('user'),
                "preset_id": session_serializer.data.get('preset')
            },
            "sets": sets_data
        }, status=201)


@extend_schema(
    request=VolumeCalculationRequestSerializer,
    responses={200: VolumeCalculationResponseSerializer},
    description="Calculate total workout volume from a list of sets"
)
@api_view(["POST"])
def calculate_volume(request):
    request_serializer = VolumeCalculationRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    sets = request_serializer.validated_data["sets"]
    total_volume = 0
    volume_by_exercise = {}

    for set_item in sets:
        set_volume = float(set_item["weight_lbs"] * set_item["reps"])
        total_volume += set_volume

        exercise_id = set_item["exercise_id"]
        if exercise_id not in volume_by_exercise:
            volume_by_exercise[exercise_id] = 0
        volume_by_exercise[exercise_id] += set_volume

    return Response({
        "total_volume": float(total_volume),
        "volume_by_exercise": volume_by_exercise
    })


class WorkoutPlanViewSet(viewsets.ModelViewSet):
    """ViewSet for workout plans - users can create plans and 'use' them to copy presets."""
    serializer_class = WorkoutPlanSerializer
    
    def get_queryset(self):
        # For list action, only return user's own plans
        if self.action == "list":
            return WorkoutPlan.objects.filter(user=self.request.user)
        # For detail actions, allow accessing any plan (permissions checked in action methods)
        return WorkoutPlan.objects.all()

    def list(self, request, *args, **kwargs):
        return Response([model_to_dict(obj) for obj in self.get_queryset()])

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        # Only allow retrieving own plans
        if obj.user_id != request.user.id:
            return Response({"error": "Not found"}, status=404)
        return Response(model_to_dict(obj))

    def _require_owned_plan(self, request):
        obj = self.get_object()
        if obj.user_id != request.user.id:
            return None, Response({"error": "Cannot modify plans created by another user"}, status=403)
        return obj, None

    def update(self, request, *args, **kwargs):
        _, error = self._require_owned_plan(request)
        if error is not None:
            return error
        return self.partial_update(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        name = data.get("name")
        description = data.get("description", "")
        if not isinstance(name, str) or not name.strip():
            return Response({"error": "name is required"}, status=400)
        if description is None:
            description = ""
        elif not isinstance(description, str):
            return Response({"error": "Invalid description"}, status=400)

        preset_ids = data.get("preset_ids", [])
        if not isinstance(preset_ids, list):
            return Response({"error": "preset_ids must be a list"}, status=400)

        accessible_presets = WorkoutPreset.objects.filter(
            Q(user=request.user) | Q(user__isnull=True) | Q(is_public=True)
        )
        presets = []
        seen_preset_ids = set()
        for preset_id in preset_ids:
            if isinstance(preset_id, bool):
                return Response({"error": "One or more presets are unavailable"}, status=400)
            try:
                normalized_id = int(preset_id)
                if normalized_id < 1 or normalized_id in seen_preset_ids:
                    return Response(
                        {"error": "One or more presets are unavailable"},
                        status=400,
                    )
                seen_preset_ids.add(normalized_id)
                presets.append(accessible_presets.get(id=normalized_id))
            except (WorkoutPreset.DoesNotExist, TypeError, ValueError):
                return Response({"error": "One or more presets are unavailable"}, status=400)

        if any(preset_has_hidden_exercises(preset, request.user) for preset in presets):
            return Response({"error": "One or more presets are unavailable"}, status=400)

        with transaction.atomic():
            plan = WorkoutPlan.objects.create(
                user=request.user,
                name=name.strip(),
                description=description,
            )
            WorkoutPlanPreset.objects.bulk_create([
                WorkoutPlanPreset(plan=plan, preset=preset, order=index)
                for index, preset in enumerate(presets)
            ])
        return Response(model_to_dict(plan), status=201)

    def partial_update(self, request, *args, **kwargs):
        obj, error = self._require_owned_plan(request)
        if error is not None:
            return error
        allowed_fields = {"name", "description"}
        for k, v in request.data.items():
            if k in allowed_fields:
                setattr(obj, k, v)
        obj.save()
        return Response(model_to_dict(obj))

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        # Only allow deleting own plans
        if obj.user_id != request.user.id:
            return Response({"error": "Cannot delete plans created by another user"}, status=403)
        obj.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"])
    def use_plan(self, request, pk=None):
        """Copy all presets from this plan to the user's presets."""
        plan = self.get_object()

        # Verify the plan belongs to the user
        if plan.user_id != request.user.id:
            return Response({"error": "Cannot use a plan created by another user"}, status=403)

        copied_presets = []
        plan_presets = plan.plan_presets.select_related("preset").prefetch_related(
            "preset__exercises__exercise",
            "preset__exercises__superset_exercises__exercise",
        ).order_by("order")

        templates = []
        for plan_preset in plan_presets:
            template = plan_preset.preset
            if not user_can_access_preset(template, request.user) or preset_has_hidden_exercises(
                template, request.user
            ):
                return Response(
                    {"error": "Plan contains a preset with an unavailable exercise"},
                    status=403,
                )
            templates.append(template)

        with transaction.atomic():
            copied_presets.extend(
                copy_preset_for_user(template, request.user)
                for template in templates
            )

        # Serialize the copied presets with exercises
        preset_serializer = WorkoutPresetSerializer(copied_presets, many=True)

        return Response({
            "message": f"Copied {len(copied_presets)} presets from plan '{plan.name}'",
            "presets": preset_serializer.data
        }, status=201)
