from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from datetime import datetime
from django.db.models import Prefetch, Q
from drf_spectacular.utils import extend_schema
from .models import (
    Exercise, WorkoutSession, WorkoutSet, WorkoutPreset,
    WorkoutPresetExercise, WorkoutPlan, WorkoutPlanPreset, SupersetExerciseItem
)
from .services import generate_sets_from_preset
from .serializers import (
    ExerciseSerializer, WorkoutSetSerializer, WorkoutSessionSerializer,
    WorkoutPresetSerializer, WorkoutPlanSerializer,
    VolumeCalculationRequestSerializer, VolumeCalculationResponseSerializer
)

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

    return result


class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all().prefetch_related('muscle_groups', 'equipment')
    serializer_class = ExerciseSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # User-created exercises are always owned by the user
        serializer.save(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        # Common exercises (user=None) cannot be modified
        if obj.user is None:
            return Response({"error": "Cannot modify common exercises"}, status=403)
        # User exercises can only be modified by their owner
        if obj.user_id != request.user.id:
            return Response({"error": "Cannot modify exercises created by another user"}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        # Common exercises (user=None) cannot be deleted
        if obj.user is None:
            return Response({"error": "Cannot delete common exercises"}, status=403)
        # User exercises can only be deleted by their owner
        if obj.user_id != request.user.id:
            return Response({"error": "Cannot delete exercises created by another user"}, status=403)
        return super().destroy(request, *args, **kwargs)


class WorkoutSetViewSet(viewsets.ModelViewSet):
    """ViewSet for managing individual workout sets (marking complete, updating weight/reps)."""
    serializer_class = WorkoutSetSerializer
    
    def get_queryset(self):
        return WorkoutSet.objects.filter(session__user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        return Response(model_to_dict(self.get_object()))

    def partial_update(self, request, *args, **kwargs):
        """Update set details (weight, reps) or mark as complete."""
        obj = self.get_object()
        for k, v in request.data.items():
            setattr(obj, k, v)
        obj.save()
        return Response(model_to_dict(obj))

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Mark a set as completed with current timestamp."""
        obj = self.get_object()
        from django.utils import timezone
        obj.completed_at = timezone.now()
        obj.save()
        return Response(model_to_dict(obj))


class WorkoutSessionViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSessionSerializer
    
    def get_queryset(self):
        return WorkoutSession.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        return Response([model_to_dict(obj) for obj in self.get_queryset()])

    def retrieve(self, request, *args, **kwargs):
        return Response(model_to_dict(self.get_object()))

    def create(self, request, *args, **kwargs):
        from django.utils import timezone
        from datetime import datetime
        data = request.data.copy()
        # Extract sets data before creating session (sets can't be directly assigned)
        sets_data = data.pop('sets', None)

        # Map frontend field names to Django model field names
        if 'startedAt' in data:
            started_at = data.pop('startedAt')
            # Parse ISO format datetime string from JavaScript
            if isinstance(started_at, str):
                # Handle various ISO formats from JS toISOString()
                # JS: "2025-01-06T09:00:00.000Z" or "2025-01-06T09:00:00.000+00:00"
                data['created_at'] = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            else:
                data['created_at'] = started_at
        # Default to server time if not provided
        if 'created_at' not in data or data.get('created_at') is None:
            data['created_at'] = timezone.now()
        if 'endedAt' in data:
            ended_at = data.pop('endedAt')
            if isinstance(ended_at, str):
                data['finished_at'] = datetime.fromisoformat(ended_at.replace('Z', '+00:00'))
            else:
                data['finished_at'] = ended_at

        data["user_id"] = request.user.id
        obj = WorkoutSession.objects.create(**data)

        # Handle sets creation if provided
        if sets_data:
            for idx, set_data in enumerate(sets_data):
                # Map frontend field names to Django model field names
                mapped_data = {
                    'session': obj,
                    'set_order': set_data.get('set_order', idx),
                    'exercise_id': set_data.get('exerciseId'),
                    'set_type': set_data.get('setType', 'normal'),
                    'weight': set_data.get('weight'),
                    'reps': set_data.get('reps'),
                    'completed_at': set_data.get('loggedAt'),
                }
                # Remove None values to let defaults apply
                mapped_data = {k: v for k, v in mapped_data.items() if v is not None}
                WorkoutSet.objects.create(**mapped_data)

        return Response(model_to_dict(obj), status=201)

    def partial_update(self, request, *args, **kwargs):
        from datetime import datetime
        obj = self.get_object()
        # Handle special fields that aren't simple attributes
        data = request.data.copy() if hasattr(request.data, 'copy') else request.data
        sets_data = data.pop('sets', None)

        # Map frontend field names to Django model field names
        if 'startedAt' in data:
            started_at = data.pop('startedAt')
            if isinstance(started_at, str):
                data['created_at'] = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            else:
                data['created_at'] = started_at
        if 'endedAt' in data:
            ended_at = data.pop('endedAt')
            if isinstance(ended_at, str):
                data['finished_at'] = datetime.fromisoformat(ended_at.replace('Z', '+00:00'))
            else:
                data['finished_at'] = ended_at

        # Update simple attributes
        for k, v in data.items():
            setattr(obj, k, v)
        obj.save()

        # Handle sets update - delete existing sets and create new ones
        if sets_data is not None:
            # Delete existing sets for this session
            WorkoutSet.objects.filter(session=obj).delete()
            # Create new sets from the provided data
            for idx, set_data in enumerate(sets_data):
                # Map frontend field names to Django model field names
                mapped_data = {
                    'session': obj,
                    'set_order': set_data.get('set_order', idx),  # Use provided order or index
                    'exercise_id': set_data.get('exerciseId'),  # frontend sends exerciseId
                    'set_type': set_data.get('setType', 'normal'),  # frontend sends setType
                    'weight': set_data.get('weight'),
                    'reps': set_data.get('reps'),
                    'completed_at': set_data.get('loggedAt'),  # frontend sends loggedAt
                }
                # Remove None values to let defaults apply
                mapped_data = {k: v for k, v in mapped_data.items() if v is not None}
                WorkoutSet.objects.create(**mapped_data)

        return Response(model_to_dict(obj))

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
        return Response(model_to_dict(obj))


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
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # Set the user to the current user when creating
        serializer.save(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        # Template presets (user=None) cannot be modified
        if obj.user is None:
            return Response({"error": "Cannot modify template presets"}, status=403)
        # User presets can only be modified by their owner
        if obj.user_id != request.user.id:
            return Response({"error": "Cannot modify presets created by another user"}, status=403)

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

        # Create a new preset for the user
        new_preset = WorkoutPreset.objects.create(
            user=request.user,
            name=template.name,
            notes=template.notes,
        )

        # Copy all exercises from the template
        preset_exercises = template.exercises.prefetch_related(
            "superset_exercises__exercise"
        ).order_by("order")

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
            # Copy superset items if applicable
            if preset_ex.type == "superset":
                for sup_item in preset_ex.superset_exercises.all():
                    SupersetExerciseItem.objects.create(
                        superset=new_preset_ex,
                        exercise=sup_item.exercise,
                        type=sup_item.type,
                        dropdowns=sup_item.dropdowns,
                        include_warmup=sup_item.include_warmup,
                        order=sup_item.order,
                    )

        serializer = self.get_serializer(new_preset)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=["post"])
    def start_workout(self, request, pk=None):
        """Create a WorkoutSession from this preset with all sets.
        Accepts optional 'startedAt' parameter to allow client-provided timestamp.
        """
        from django.utils import timezone
        preset = self.get_object()

        # Get client-provided start time if available, otherwise use server time
        started_at = request.data.get('startedAt')
        if started_at:
            # Parse ISO format datetime string
            from datetime import datetime
            if isinstance(started_at, str):
                created_time = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            else:
                created_time = started_at
        else:
            created_time = timezone.now()

        # Create the workout session
        session = WorkoutSession.objects.create(
            user=request.user,
            preset=preset,
            name=preset.name,
            notes=preset.notes,
            created_at=created_time
        )

        # Prefetch and convert to list
        preset_exercises = list(preset.exercises.prefetch_related(
            "superset_exercises__exercise"
        ).order_by("order"))

        # Generate WorkoutSet instances (unsaved)
        sets = generate_sets_from_preset(preset_exercises, session)

        # Bulk create
        WorkoutSet.objects.bulk_create(sets)

        return Response({
            "session": model_to_dict(session),
            "sets": [model_to_dict(s) for s in session.sets.all()]
        }, status=201)


@extend_schema(
    request=VolumeCalculationRequestSerializer,
    responses={200: VolumeCalculationResponseSerializer},
    description="Calculate total workout volume from a list of sets"
)
@api_view(["POST"])
def calculate_volume(request):
    sets = request.data.get("sets", [])
    total_volume = 0
    volume_by_exercise = {}

    for set_item in sets:
        weight = set_item.get("weight_lbs", 0) or 0
        reps = set_item.get("reps", 0) or 0
        set_volume = weight * reps
        total_volume += set_volume

        exercise_id = set_item.get("exercise_id", "unknown")
        if exercise_id not in volume_by_exercise:
            volume_by_exercise[exercise_id] = 0
        volume_by_exercise[exercise_id] += set_volume

    return Response({
        "total_volume": total_volume,
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

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["user_id"] = request.user.id
        # Create the plan
        plan = WorkoutPlan.objects.create(
            user=request.user,
            name=data.get("name"),
            description=data.get("description", ""),
        )
        # Add presets if provided
        preset_ids = data.get("preset_ids", [])
        for idx, preset_id in enumerate(preset_ids):
            try:
                preset = WorkoutPreset.objects.get(id=preset_id)
                WorkoutPlanPreset.objects.create(
                    plan=plan,
                    preset=preset,
                    order=idx
                )
            except WorkoutPreset.DoesNotExist:
                continue
        return Response(model_to_dict(plan), status=201)

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        # Only allow modifying own plans
        if obj.user_id != request.user.id:
            return Response({"error": "Cannot modify plans created by another user"}, status=403)
        for k, v in request.data.items():
            if k != "preset_ids":  # Handle preset_ids separately
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
        plan_presets = plan.plan_presets.all().order_by("order")

        for plan_preset in plan_presets:
            template = plan_preset.preset

            # Create a new preset for the user
            new_preset = WorkoutPreset.objects.create(
                user=request.user,
                name=template.name,
                notes=template.notes,
            )

            # Copy all exercises from the template
            preset_exercises = template.exercises.prefetch_related(
                "superset_exercises__exercise"
            ).order_by("order")

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
                # Copy superset items if applicable
                if preset_ex.type == "superset":
                    for sup_item in preset_ex.superset_exercises.all():
                        SupersetExerciseItem.objects.create(
                            superset=new_preset_ex,
                            exercise=sup_item.exercise,
                            type=sup_item.type,
                            dropdowns=sup_item.dropdowns,
                            include_warmup=sup_item.include_warmup,
                            order=sup_item.order,
                        )

            copied_presets.append(new_preset)

        # Serialize the copied presets with exercises
        preset_serializer = WorkoutPresetSerializer(copied_presets, many=True)

        return Response({
            "message": f"Copied {len(copied_presets)} presets from plan '{plan.name}'",
            "presets": preset_serializer.data
        }, status=201)
