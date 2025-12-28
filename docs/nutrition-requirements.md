# Nutrition Module - Business Requirements & Test Scenarios

## Table of Contents
1. [Data Models](#data-models)
2. [Business Rules](#business-rules)
3. [Functional Requirements](#functional-requirements)
4. [Test Case Scenarios](#test-case-scenarios)

---

## Data Models

### FoodItem
Core entity representing a food in the database.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| name | string | Yes | Food name |
| brand | string | No | Brand/manufacturer |
| barcode | string | No | Product barcode |
| source | enum | Yes | `canonical` | `user` | `ai_generated` |
| category | enum | Auto | `protein` | `carb` | `fat` | `mixed` |
| servingSize | number | Yes | Default serving size in grams |
| servingType | string | No | Description of serving (e.g., "1 cup") |
| calories | number | Auto | Calories per 100g (auto-calc or manual) |
| protein | number | Yes | Grams per 100g |
| carbs | number | Yes | Grams per 100g |
| fat | number | Yes | Grams per 100g |
| saturatedFat | number | No | Grams per 100g |
| sugar | number | No | Grams per 100g |
| fiber | number | No | Grams per 100g |
| sodium | number | No | Milligrams per 100g |
| glycemicIndex | number | No | 0-100 scale |
| absorptionSpeed | enum | No | `slow` | `moderate` | `fast` |
| insulinResponse | number | No | 0-100 scale |
| satietyScore | number | No | 0-10 scale |
| proteinQuality | number | No | 1 (low) to 3 (high/complete) |

### Meal
Represents a logged meal for a specific date/time.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| name | string | Yes | Meal name |
| mealType | enum | Yes | `breakfast` | `lunch` | `dinner` | `snack` |
| loggedAt | string | Yes | ISO date string when logged |
| eventTime | string | No | Actual time of meal (ISO) |
| notes | string | No | User notes |
| source | enum | Yes | `manual` | `ai_assisted` |
| foods | MealFoodItem[] | Yes | Array of foods in meal |
| totalCalories | number | Calc | Sum of all foods |
| totalProtein | number | Calc | Sum of all foods |
| totalCarbs | number | Calc | Sum of all foods |
| totalFat | number | Calc | Sum of all foods |

### MealFoodItem (Linking Entity)
Connects a food to a meal with quantity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| foodId | string | Yes | Reference to FoodItem |
| grams | number | Yes | Weight in grams |

### MealTemplate
Reusable meal composition for quick logging.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| name | string | Yes | Template name |
| category | string | No | User-defined category |
| foods | MealFoodItem[] | Yes | Array of foods |

---

## Business Rules

### BR-001: Calorie Calculation
- **Rule**: Calories can be auto-calculated from macronutrients
- **Formula**: `calories = (protein × 4) + (carbs × 4) + (fat × 9)`
- **Override**: Users can manually override the calculated value

### BR-002: Category Auto-Detection
- **Rule**: Food category is automatically determined by macro ratios
- **Logic**:
  - If protein calories > 40% of total → `protein`
  - Else if carb calories > 40% of total → `carb`
  - Else if fat calories > 40% of total → `fat`
  - Else → `mixed`

### BR-003: Meal Totals Calculation
- **Rule**: Meal nutrition totals are calculated from constituent foods
- **Formula per nutrient**: `total = sum(food.nutrientPer100g × (grams / 100))`

### BR-004: Aggregate Metabolic Properties
For combinations of foods, metabolic properties are aggregated:

| Property | Aggregation Method |
|----------|-------------------|
| Glycemic Index | Weighted average by carb content |
| Absorption Speed | Dominant: slow > moderate > fast |
| Insulin Response | Weighted average by calories |
| Satiety Score | Weighted average by calories |

### BR-005: Minimum Meal Requirements
- **Rule**: A meal must contain at least one food item
- **Validation**: Meal creation fails if foods array is empty

### BR-006: Source Attribution
- All food items must have a source tracked:
  - `canonical` - Predefined database entries
  - `user` - User-created entries
  - `ai_generated` - Created via AI analysis

### BR-007: AI-Generated Data Review
- **Rule**: All AI-generated food items require user confirmation before saving
- **Flow**: AI suggests → User reviews → User confirms → Data saved

### BR-008: Daily Goals
- Default goals (hardcoded):
  - Calories: 2500
  - Protein: 130g
- Note: These should become user-configurable in future

### BR-009: Date-Based Meal Retrieval
- **Rule**: Meals are queried and displayed by logged date
- **Timezone**: Uses user's local timezone for display

---

## Functional Requirements

### FR-001: Food Management

#### FR-001.1: Create Food
- User can manually create a food item with all nutrition fields
- System auto-calculates calories if not provided
- System auto-detects category
- System infers metabolic properties based on name and macros

#### FR-001.2: Create Food via AI
- User can upload up to 3 images of food
- User can provide text description
- System uses AI to extract nutrition information
- User reviews and confirms before saving
- AI-generated foods marked with `ai_generated` source

#### FR-001.3: Search Foods
- User can search foods by name
- User can filter by category
- Results show name, brand, and per-100g nutrition

#### FR-001.4: Update Food
- User can edit any food item
- Changes cascade to meals and templates using that food

#### FR-001.5: Delete Food
- User can delete custom foods (`user`, `ai_generated` sources)
- Canonical foods cannot be deleted
- Warning if food is used in meals or templates

### FR-002: Meal Logging

#### FR-002.1: Log Meal from Scratch
- User creates meal by selecting individual foods
- User adjusts gram quantities for each food
- System shows real-time nutrition totals
- User assigns meal type and optional notes

#### FR-002.2: Log Meal from Template
- User selects a template
- System pre-populates foods and quantities
- User can adjust before finalizing
- System calculates totals

#### FR-002.3: Log Meal via AI
- User describes meal via text or voice
- User can upload images
- AI suggests foods and quantities
- User reviews and confirms

#### FR-002.4: Save Meal as Food
- User can save a complete meal as a single food item
- Creates new food in database with combined nutrition

#### FR-002.5: View Meals by Date
- User views all meals for a selected date
- System shows daily totals vs goals
- User navigates between dates

### FR-003: Template Management

#### FR-003.1: Create Template
- User creates template from food combinations
- User assigns name and category

#### FR-003.2: Use Template
- User selects template to quickly log meal
- Quantities can be adjusted before logging

#### FR-003.3: Edit/Delete Template
- User can modify existing templates
- User can delete unused templates

### FR-004: Nutrition Display

#### FR-004.1: Food Detail View
- Shows all nutrition fields per 100g
- Shows metabolic properties
- Shows serving info

#### FR-004.2: Meal Summary
- Shows total calories, protein, carbs, fat
- Shows breakdown by food item
- Shows aggregate metabolic properties

#### FR-004.3: Daily Summary
- Shows all meals for date
- Shows cumulative totals
- Shows progress toward goals
- Generates advice based on progress

### FR-005: AI Integration

#### FR-005.1: Image Analysis
- Accepts up to 3 images
- Extracts food type, approximate quantity
- Estimates nutrition

#### FR-005.2: Text Analysis
- Accepts natural language descriptions
- Extracts food items and quantities
- Handles common serving descriptions

#### FR-005.3: Voice Input
- Accepts voice dictation
- Converts to text for analysis

---

## Test Case Scenarios

### TC-001: Food Creation

#### TC-001.1: Manual Food Creation with Auto-Calculated Calories
**Preconditions**: User is on Food Items tab, clicks "Add Food"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter name: "Chicken Breast" | Name accepted |
| 2 | Enter protein: 23g | Protein saved |
| 3 | Enter carbs: 0g | Carbs saved |
| 4 | Enter fat: 1g | Fat saved |
| 5 | Leave calories blank | Calories auto-calculated as 105 (23×4 + 0×4 + 1×9) |
| 6 | Save | Food created with `category: protein` |

#### TC-001.2: Manual Food Creation with Override Calories
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1-4 | Same as above | Same as above |
| 5 | Enter calories: 110 | Manual value accepted |
| 6 | Save | Food created with 110 calories |

#### TC-001.3: Food Category Detection
| Input Macros | Expected Category |
|--------------|-------------------|
| P: 30g, C: 5g, F: 2g | protein |
| P: 5g, C: 45g, F: 2g | carb |
| P: 2g, C: 5g, F: 35g | fat |
| P: 15g, C: 15g, F: 10g | mixed |

### TC-002: Food Search and Selection

#### TC-002.1: Search by Name
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter "chicken" in search | Results show foods with "chicken" |
| 2 | Clear search | All foods shown |

#### TC-002.2: Filter by Category
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "protein" filter | Only protein foods shown |
| 2 | Select "carb" filter | Only carb foods shown |

### TC-003: Meal Logging

#### TC-003.1: Log Simple Meal
**Preconditions**: Food "Chicken Breast" exists (P: 23, C: 0, F: 1 per 100g)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Log Meal" | Modal opens |
| 2 | Select "Chicken Breast" | Food added to meal |
| 3 | Set quantity to 150g | Nutrition updates: C: 157.5, P: 34.5, C: 0, F: 1.5 |
| 4 | Select meal type: "lunch" | Type saved |
| 5 | Save | Meal created with correct totals |

#### TC-003.2: Log Multi-Food Meal
**Preconditions**: Foods exist - Chicken (100g), Rice (100g), Broccoli (100g)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add Chicken 150g | Shows partial totals |
| 2 | Add Rice 200g | Shows cumulative totals |
| 3 | Add Broccoli 100g | Shows final totals |
| 4 | Verify totals | Correct sum of all foods |

#### TC-003.3: Log Meal from Template
**Preconditions**: Template "Protein Bowl" exists with foods

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Log from Template" | Template list shown |
| 2 | Select "Protein Bowl" | Foods pre-populated |
| 3 | Adjust one quantity | Total recalculates |
| 4 | Save | Meal logged with adjustments |

#### TC-003.4: Validate Meal Requires Food
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Log Meal" | Modal opens |
| 2 | Enter name only, no foods | Save button disabled or error shown |
| 3 | Add at least one food | Save becomes enabled |

### TC-004: Meal Totals Calculation

#### TC-004.1: Verify Calorie Sum
**Given**: Meal with Rice (200g, 130 cal/100g) and Chicken (150g, 165 cal/100g)

| Calculation | Expected |
|-------------|----------|
| Rice calories | 130 × (200/100) = 260 |
| Chicken calories | 165 × (150/100) = 247.5 |
| Total calories | 507.5 |

#### TC-004.2: Verify Macro Sum
**Given**: Same meal as above

| Calculation | Expected |
|-------------|----------|
| Rice: P=3, C=28, F=0.3 (per 100g) | For 200g: P=6, C=56, F=0.6 |
| Chicken: P=23, C=0, F=9 (per 100g) | For 150g: P=34.5, C=0, F=13.5 |
| Total | P=40.5, C=56, F=14.1 |

### TC-005: Template Management

#### TC-005.1: Create Template from Meal
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View existing meal | Meal details shown |
| 2 | Click "Save as Template" | Template form opens |
| 3 | Enter name: "My Go-To Lunch" | Name accepted |
| 4 | Enter category: "favorites" | Category saved |
| 5 | Save | Template created with same foods |

#### TC-005.2: Delete Template
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select template | Template shown |
| 2 | Click delete | Confirmation prompt |
| 3 | Confirm | Template removed, meals unaffected |

### TC-006: AI Food Creation

#### TC-006.1: Image-Based Food Entry
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add with AI" | AI modal opens |
| 2 | Upload image of banana | Image preview shown |
| 3 | Submit for analysis | AI returns nutrition estimate |
| 4 | Review results | Shows name, macros, confidence |
| 5 | Adjust if needed | Values editable |
| 6 | Confirm | Food created with `ai_generated` source |

#### TC-006.2: Multi-Image Analysis
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload 3 images of meal | All images shown |
| 2 | Add text: "grilled salmon" | Context provided |
| 3 | Analyze | AI combines all inputs |
| 4 | Review | Combined analysis shown |

### TC-007: Daily Summary

#### TC-007.1: View Daily Totals
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to today | All today's meals listed |
| 2 | View summary | Totals: calories, protein, carbs, fat |
| 3 | Compare to goals | Shows progress toward 2500 cal, 130g protein |

#### TC-007.2: Date Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Previous Day" | Shows yesterday's meals and totals |
| 2 | Click "Next Day" | Returns to today |
| 3 | Click specific date | Shows that date's data |

### TC-008: Aggregate Metabolic Properties

#### TC-008.1: Glycemic Index Weighted Average
**Given**: Food A (GI=80, 20g carbs) and Food B (GI=40, 60g carbs)

| Calculation | Expected |
|-------------|----------|
| Weighted GI | (80×20 + 40×60) / (20+60) = 50 |

#### TC-008.2: Absorption Speed Priority
**Given**: Fast + Slow + Moderate foods combined

| Composition | Expected Result |
|-------------|-----------------|
| Any slow food present | Speed = "slow" |
| No slow, moderate present | Speed = "moderate" |
| Only fast foods | Speed = "fast" |

### TC-009: Food Editing and Deletion

#### TC-009.1: Edit Food
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open food detail | Current values shown |
| 2 | Change protein from 23 to 25 | Value updated |
| 3 | Save | Food updated, future calculations use new value |

#### TC-009.2: Delete Custom Food
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select user-created food | Delete option available |
| 2 | Click delete | Food removed |

#### TC-009.3: Cannot Delete Canonical Food
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select canonical food | Delete option disabled or hidden |
| 2 | Attempt delete | Error: "Cannot delete database food" |

### TC-010: Edge Cases

#### TC-010.1: Zero Quantity Food
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add food to meal | Food added |
| 2 | Set grams to 0 | Food contributes 0 to totals |

#### TC-010.2: Very Large Quantity
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set grams to 5000 | Calculation scales proportionally |
| 2 | Save | Value accepted |

#### TC-010.3: Negative Quantity (Should Be Prevented)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt negative grams | Input rejected or clamped to 0 |

#### TC-010.4: Meal with Many Foods
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 20+ foods to meal | All foods shown |
| 2 | Verify totals | Correct sum of all foods |

### TC-011: Daily Advice Generation

#### TC-011.1: Below Protein Goal
**Given**: Daily protein = 80g, Goal = 130g

| Expected Output | "You are 50g below your protein goal" |

#### TC-011.2: At Protein Goal
**Given**: Daily protein >= 130g

| Expected Output | Positive message or no protein warning |

#### TC-011.3: Above Calorie Goal
**Given**: Daily calories > 2500

| Expected Output | Warning about exceeding calorie goal |

### TC-012: Save Meal as Food

#### TC-012.1: Convert Meal to Single Food
**Given**: Meal "Protein Bowl" with 3 foods, totals: C=500, P=40, C=50, F=15

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View meal | Details shown |
| 2 | Click "Save as Food" | Form opens |
| 3 | Enter name: "Custom Protein Bowl" | Name accepted |
| 4 | Save | New food created with meal's nutrition per 100g equivalent |

---

## Non-Functional Requirements

### NFR-001: Performance
- Food search results appear within 500ms
- Meal totals update in real-time as quantities change
- AI analysis completes within 10 seconds

### NFR-002: Usability
- All numeric inputs support incremental buttons (+/-)
- Common foods appear at top of search results
- Recently used foods shown first

### NFR-003: Data Persistence
- All data persisted to local storage/database
- No data loss on refresh or navigation
- Offline support for viewing logged data

### NFR-004: Extensibility
- Daily goals should become user-configurable
- Additional nutrition fields should be addable
- New food categories should be supported

---

## Future Enhancements (Out of Scope for Current Implementation)

1. **User Configurable Goals**: Custom calorie and macro targets
2. **Micronutrient Tracking**: Vitamins and minerals
4. **Recipe Management**: Multi-ingredient preparation instructions
5. **Water Tracking**: Daily hydration logging
6. **Food Sharing**: Community food database
7. **Barcode Scanner**: Quick product lookup
8. **Nutrition Reports**: Weekly/monthly trend analysis
