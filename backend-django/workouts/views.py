from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from datetime import datetime
from django.db.models import Prefetch
from .models import (
    Exercise, WorkoutSession, WorkoutSet, WorkoutPreset,
    WorkoutPresetExercise
)
from .services import generate_sets_from_preset


def model_to_dict(instance):
    return {k: v for k, v in instance.__dict__.items() if not k.startswith("_")}


class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        return Response([model_to_dict(obj) for obj in queryset])

    def retrieve(self, request, *args, **kwargs):
        return Response(model_to_dict(self.get_object()))

    def create(self, request, *args, **kwargs):
        data = request.data
        obj = Exercise.objects.create(**data)
        return Response(model_to_dict(obj), status=201)

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        for k, v in request.data.items():
            setattr(obj, k, v)
        obj.save()
        return Response(model_to_dict(obj))

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.delete()
        return Response(status=204)


class WorkoutSessionViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return WorkoutSession.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        return Response([model_to_dict(obj) for obj in self.get_queryset()])

    def retrieve(self, request, *args, **kwargs):
        return Response(model_to_dict(self.get_object()))

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["user_id"] = request.user.id
        obj = WorkoutSession.objects.create(**data)
        return Response(model_to_dict(obj), status=201)

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        for k, v in request.data.items():
            setattr(obj, k, v)
        obj.save()
        return Response(model_to_dict(obj))

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.delete()
        return Response(status=204)


class WorkoutPresetViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return WorkoutPreset.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        return Response([model_to_dict(obj) for obj in self.get_queryset()])

    def retrieve(self, request, *args, **kwargs):
        return Response(model_to_dict(self.get_object()))

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["user_id"] = request.user.id
        obj = WorkoutPreset.objects.create(**data)
        return Response(model_to_dict(obj), status=201)

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        for k, v in request.data.items():
            setattr(obj, k, v)
        obj.save()
        return Response(model_to_dict(obj))

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"])
    def start_workout(self, request, pk=None):
        """Create a WorkoutSession from this preset with all sets."""
        preset = self.get_object()

        # Create the workout session
        session = WorkoutSession.objects.create(
            user=request.user,
            preset=preset,
            name=preset.name,
            notes=preset.notes
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
