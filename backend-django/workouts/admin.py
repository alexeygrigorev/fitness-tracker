from django.contrib import admin
from .models import (
    MuscleRegion, MuscleGroup, Equipment, ExerciseTag, Exercise,
    WorkoutPreset, WorkoutPresetExercise, SupersetExerciseItem,
    WorkoutSession, WorkoutSet
)


class SupersetExerciseItemInline(admin.TabularInline):
    model = SupersetExerciseItem
    extra = 1


class WorkoutPresetExerciseInline(admin.TabularInline):
    model = WorkoutPresetExercise
    extra = 1


@admin.register(MuscleRegion)
class MuscleRegionAdmin(admin.ModelAdmin):
    list_display = ["id", "name"]


@admin.register(MuscleGroup)
class MuscleGroupAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "region"]


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ["id", "name"]


@admin.register(ExerciseTag)
class ExerciseTagAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "is_preset"]


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "is_compound"]
    filter_horizontal = ["muscle_groups", "tags"]


@admin.register(WorkoutPreset)
class WorkoutPresetAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "user"]
    inlines = [WorkoutPresetExerciseInline]


@admin.register(WorkoutPresetExercise)
class WorkoutPresetExerciseAdmin(admin.ModelAdmin):
    list_display = ["id", "preset", "exercise", "type", "sets", "order"]
    inlines = [SupersetExerciseItemInline]


@admin.register(WorkoutSession)
class WorkoutSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "user", "created_at"]


@admin.register(WorkoutSet)
class WorkoutSetAdmin(admin.ModelAdmin):
    list_display = ["id", "session", "exercise", "set_type", "set_order"]
