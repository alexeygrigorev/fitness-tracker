from django.db import models


class MuscleRegion(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class MuscleGroup(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    region = models.ForeignKey(MuscleRegion, on_delete=models.CASCADE, related_name='muscle_groups', null=True, blank=True)

    def __str__(self):
        return self.name


class Equipment(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class ExerciseTag(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    is_preset = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class Exercise(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    muscle_groups = models.ManyToManyField(MuscleGroup, related_name='exercises', blank=True)
    equipment = models.ForeignKey(Equipment, on_delete=models.SET_NULL, null=True, blank=True, related_name='exercises')
    tags = models.ManyToManyField(ExerciseTag, related_name='exercises', blank=True)
    description = models.TextField(blank=True, null=True)
    is_compound = models.BooleanField(default=False)
    is_bodyweight = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class WorkoutPreset(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='workout_presets')
    name = models.CharField(max_length=255)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class WorkoutPresetExercise(models.Model):
    TYPES = [
        ('normal', 'Normal'),
        ('dropdown', 'Dropdown'),
        ('superset', 'Superset'),
    ]

    id = models.AutoField(primary_key=True)
    preset = models.ForeignKey(WorkoutPreset, on_delete=models.CASCADE, related_name='exercises')
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, null=True, blank=True, related_name='preset_exercises')
    type = models.CharField(max_length=20, choices=TYPES, default='normal')
    sets = models.IntegerField(default=3)
    dropdowns = models.IntegerField(null=True, blank=True)
    include_warmup = models.BooleanField(default=False)
    order = models.IntegerField()

    def __str__(self):
        if self.exercise:
            return f"{self.preset.name} - {self.exercise.name} ({self.type})"
        return f"{self.preset.name} - {self.type}"


class SupersetExerciseItem(models.Model):
    TYPES = [
        ('normal', 'Normal'),
        ('dropdown', 'Dropdown'),
    ]

    id = models.AutoField(primary_key=True)
    superset = models.ForeignKey(WorkoutPresetExercise, on_delete=models.CASCADE, related_name='superset_exercises')
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name='superset_items')
    type = models.CharField(max_length=20, choices=TYPES, default='normal')
    dropdowns = models.IntegerField(null=True, blank=True)
    include_warmup = models.BooleanField(default=False)
    order = models.IntegerField()

    def __str__(self):
        return f"{self.exercise.name} ({self.type})"


class WorkoutSession(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)

    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='workout_sessions')
    preset = models.ForeignKey(WorkoutPreset, on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')

    notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} - {self.created_at}"


class WorkoutSet(models.Model):
    SET_TYPES = [
        ('normal', 'Normal'),
        ('bodyweight', 'Bodyweight'),
        ('dropdown', 'Dropdown'),
    ]

    id = models.AutoField(primary_key=True)
    session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name='sets')
    set_order = models.IntegerField()

    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)

    set_type = models.CharField(max_length=20, choices=SET_TYPES, default='normal')
    weight = models.DecimalField(null=True, blank=True, max_digits=6, decimal_places=2)
    reps = models.IntegerField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.exercise.name} - {self.set_type} Set {self.set_order}"


# class ActiveWorkoutState(models.Model):
#     id = models.AutoField(primary_key=True)
#     user = models.OneToOneField('users.User', on_delete=models.CASCADE, related_name='active_workout_state')
#     preset_id = models.IntegerField(null=True, blank=True)
#     session_id = models.IntegerField(null=True, blank=True)
#     started_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)
#     data = models.JSONField(default=dict)

#     def __str__(self):
#         return f"Active workout for {self.user.username}"
