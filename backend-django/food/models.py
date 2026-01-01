from django.db import models


class FoodItem(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='food_items', null=True, blank=True)
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=255, blank=True, null=True)

    # Barcode for scanning
    barcode = models.CharField(max_length=255, blank=True, null=True)

    # Source of the food data
    SOURCE_CHOICES = [
        ('canonical', 'Canonical'),
        ('user', 'User'),
        ('ai_generated', 'AI Generated'),
    ]
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='user')

    # Serving info
    serving_size = models.DecimalField(max_digits=10, decimal_places=2)
    serving_unit = models.CharField(max_length=50)

    # Macros - using frontend naming convention for API consistency
    calories = models.DecimalField(max_digits=10, decimal_places=2)
    protein = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    carbs = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fat = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fiber = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sugar = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Additional nutritional info
    saturated_fat = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    sodium = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)  # in mg

    # Category: carb, protein, fat, mixed, beverage
    CATEGORY_CHOICES = [
        ('carb', 'Carb'),
        ('protein', 'Protein'),
        ('fat', 'Fat'),
        ('mixed', 'Mixed'),
        ('beverage', 'Beverage'),
    ]
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, blank=True, null=True)

    # Metabolism-related fields
    glycemic_index = models.IntegerField(blank=True, null=True)
    absorption_speed = models.CharField(
        max_length=20,
        choices=[('slow', 'Slow'), ('moderate', 'Moderate'), ('fast', 'Fast')],
        blank=True,
        null=True
    )
    insulin_response = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    satiety_score = models.IntegerField(blank=True, null=True)
    protein_quality = models.IntegerField(
        choices=[(1, 'Low'), (2, 'Moderate'), (3, 'High')],
        blank=True,
        null=True
    )

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
    grams = models.DecimalField(max_digits=10, decimal_places=2)  # Store grams directly
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
    grams = models.DecimalField(max_digits=10, decimal_places=2)  # Store grams directly
    order = models.IntegerField()

    def __str__(self):
        return f"{self.template.name} - {self.food.name}"
