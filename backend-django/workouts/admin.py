from django.contrib import admin
from .models import (
    MuscleRegion, MuscleGroup, Equipment, Exercise, 
    WorkoutSession, WorkoutSet, WorkoutPreset, WorkoutPresetExercise, ActiveWorkoutState
)


admin.site.register(MuscleRegion)
admin.site.register(MuscleGroup)
admin.site.register(Equipment)
admin.site.register(Exercise)
admin.site.register(WorkoutSession)
admin.site.register(WorkoutSet)
admin.site.register(WorkoutPreset)
admin.site.register(WorkoutPresetExercise)
admin.site.register(ActiveWorkoutState)
