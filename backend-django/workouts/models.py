from django.db import models


class MuscleRegion(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class MuscleGroup(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    region = models.ForeignKey(MuscleRegion, on_delete=models.CASCADE, related_name='muscle_groups')

    def __str__(self):
        return self.name


class Equipment(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Exercise(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    muscle_groups = models.ManyToManyField(MuscleGroup, related_name='exercises')
    equipment = models.ForeignKey(Equipment, on_delete=models.SET_NULL, null=True, blank=True, related_name='exercises')
    description = models.TextField(blank=True, null=True)
    is_compound = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class WorkoutSession(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='workout_sessions')
    name = models.CharField(max_length=255)
    notes = models.TextField(blank=True, null=True)
    date = models.DateTimeField()
    duration_seconds = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.date}"


class WorkoutSet(models.Model):
    id = models.AutoField(primary_key=True)
    session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name='sets')
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    set_type = models.CharField(max_length=20)
    weight_lbs = models.FloatField(null=True, blank=True)
    reps = models.IntegerField(null=True, blank=True)
    distance_miles = models.FloatField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    rpe = models.IntegerField(null=True, blank=True)
    set_order = models.IntegerField()

    def __str__(self):
        return f"{self.exercise.name} - Set {self.set_order}"


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
    id = models.AutoField(primary_key=True)
    preset = models.ForeignKey(WorkoutPreset, on_delete=models.CASCADE, related_name='exercises')
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    order = models.IntegerField()
    default_sets = models.JSONField(default=list)

    def __str__(self):
        return f"{self.preset.name} - {self.exercise.name}"


class ActiveWorkoutState(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField('users.User', on_delete=models.CASCADE, related_name='active_workout_state')
    preset_id = models.IntegerField(null=True, blank=True)
    session_id = models.IntegerField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    data = models.JSONField(default=dict)

    def __str__(self):
        return f"Active workout for {self.user.username}"
