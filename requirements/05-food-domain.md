# Food Domain

## Food Knowledge Layer (Ingredients)

### Food Item

- Name
- Category:
  - Carb
  - Protein
  - Fat
  - Mixed
- Nutritional values per 100g:
  - Calories
  - Protein
  - Carbohydrates
  - Fat
  - Fiber
- Metabolism-related attributes:
  - Glycemic index (estimated)
  - Absorption speed
  - Relative insulin response
  - Satiety score

Food items may be canonical, user-defined, or AI-generated.

## Meals and Meal Classification

### Meal Template

- Name
- List of ingredients and quantities
- Meal category:
  - Breakfast
  - Lunch
  - Dinner
  - Snack
  - Post-workout
  - Beverage
- Optional tags

### Meal Instance

- Timestamp
- Ingredients and quantities
- Meal category
- Notes
- Source:
  - Manual
  - AI-assisted

Beverages are logged as meals with category Beverage.

## Complex Meals Without Extra Hierarchy

Meals composed of food and drinks are logged as multiple meal instances sharing a similar timestamp window. No nested meal hierarchy is used.

## Barcode Support

### Barcode Use Cases

- Adding new food items
- Logging packaged foods
- Admin or canonical food creation

### Flow

- Scan barcode
- Lookup in internal or external databases
- Auto-fill nutrition data if found
- If not found, create draft food item with manual or AI-assisted completion

Barcode-derived items are editable and source-attributed.

## AI-Assisted Food Logging

### Supported Inputs

- Multiple photos (front, back, nutrition label, menu)
- Text notes
- Voice input
- Menu references

### Output

- Suggested ingredients
- Estimated quantities
- Confidence score
- Fully editable result

AI never finalizes without user confirmation.
