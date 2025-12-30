from django.db import models


class FoodItem(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='food_items', null=True, blank=True)
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=255, blank=True, null=True)
    serving_size = models.FloatField()
    serving_unit = models.CharField(max_length=50)
    calories_per_serving = models.FloatField()
    protein_g = models.FloatField(default=0)
    carbs_g = models.FloatField(default=0)
    fat_g = models.FloatField(default=0)
    fiber_g = models.FloatField(default=0)
    sugar_g = models.FloatField(default=0)
    sodium_mg = models.FloatField(default=0)
    category = models.CharField(max_length=50, blank=True, null=True)
    is_custom = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Meal(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='meals')
    name = models.CharField(max_length=255)
    meal_type = models.CharField(max_length=50)
    date = models.DateField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.date}"


class MealFoodItem(models.Model):
    id = models.AutoField(primary_key=True)
    meal = models.ForeignKey(Meal, on_delete=models.CASCADE, related_name='food_items')
    food = models.ForeignKey(FoodItem, on_delete=models.CASCADE)
    servings = models.FloatField(default=1)
    order = models.IntegerField()

    def __str__(self):
        return f"{self.meal.name} - {self.food.name}"


class MealTemplate(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='meal_templates')
    name = models.CharField(max_length=255)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class MealTemplateFoodItem(models.Model):
    id = models.AutoField(primary_key=True)
    template = models.ForeignKey(MealTemplate, on_delete=models.CASCADE, related_name='food_items')
    food = models.ForeignKey(FoodItem, on_delete=models.CASCADE)
    servings = models.FloatField(default=1)
    order = models.IntegerField()

    def __str__(self):
        return f"{self.template.name} - {self.food.name}"
