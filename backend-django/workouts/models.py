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


class ExerciseMuscleGroup(models.Model):
    """Through model for Exercise-MuscleGroup relationship with primary/secondary distinction."""
    TARGET_TYPE = [
        ('primary', 'Primary'),
        ('secondary', 'Secondary'),
    ]

    id = models.AutoField(primary_key=True)
    exercise = models.ForeignKey('Exercise', on_delete=models.CASCADE, related_name='exercise_muscle_groups')
    muscle_group = models.ForeignKey(MuscleGroup, on_delete=models.CASCADE, related_name='exercise_muscle_groups')
    target_type = models.CharField(max_length=20, choices=TARGET_TYPE, default='primary')

    class Meta:
        unique_together = ('exercise', 'muscle_group')

    def __str__(self):
        return f"{self.exercise.name} - {self.muscle_group.name} ({self.target_type})"


class Exercise(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, null=True, blank=True, related_name='exercises')
    name = models.CharField(max_length=255)
    muscle_groups = models.ManyToManyField(
        MuscleGroup,
        related_name='exercises',
        blank=True,
        through='ExerciseMuscleGroup',
        through_fields=('exercise', 'muscle_group')
    )
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
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('archived', 'Archived'),
    ]

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, null=True, blank=True, related_name='workout_presets')
    name = models.CharField(max_length=255)
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    day_label = models.CharField(max_length=20, blank=True, null=True, help_text="Day of week label like 'Monday', 'Tuesday'")
    tags = models.JSONField(default=list, blank=True, help_text="List of tags like ['strength', 'cardio']")
    is_public = models.BooleanField(default=False)
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


class WorkoutPlan(models.Model):
    """A workout plan containing multiple preset templates that users can adopt."""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='workout_plans')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    presets = models.ManyToManyField(
        WorkoutPreset,
        related_name='plans',
        blank=True,
        through='WorkoutPlanPreset'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class WorkoutPlanPreset(models.Model):
    """Through model for WorkoutPlan-Preset relationship with order."""
    id = models.AutoField(primary_key=True)
    plan = models.ForeignKey(WorkoutPlan, on_delete=models.CASCADE, related_name='plan_presets')
    preset = models.ForeignKey(WorkoutPreset, on_delete=models.CASCADE, related_name='plan_presets')
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']
        unique_together = ('plan', 'preset')

    def __str__(self):
        return f"{self.plan.name} - {self.preset.name} ({self.order})"


class WorkoutSession(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)

    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='workout_sessions')
    preset = models.ForeignKey(WorkoutPreset, on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')

    notes = models.TextField(blank=True, null=True)

    # Allow client-provided timestamps (for testing and offline support)
    # Defaults to current time if not provided
    created_at = models.DateTimeField(auto_now_add=False, null=True, blank=True)
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
    bodyweight = models.DecimalField(null=True, blank=True, max_digits=6, decimal_places=2, help_text="User's bodyweight at the time of completing the exercise (for bodyweight exercises)")
    dropdown_weights = models.JSONField(null=True, blank=True, help_text="For dropdown sets, stores array of {weight, reps} for each drop set")
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.exercise.name} - {self.set_type} Set {self.set_order}"
