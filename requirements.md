# Fitness, Nutrition, and Metabolism App – Requirements Specification

Version: v1.2  
Status: Consolidated requirements  
Purpose: Personal fitness, nutrition, metabolism tracking and learning system

---

## 1. Product Overview

### 1.1 Vision
Build a personal fitness and nutrition application that allows tracking, reconstruction, and understanding of physical activity, workouts, food intake, sleep, and recovery. The system connects exercises and food through a metabolism model and provides explainable, context-aware guidance. The app is goal-flexible and adapts as user goals change over time.

### 1.2 Primary User
- Fitness-oriented individual
- Goals may vary over time (gain weight, lose weight, maintain, performance, health)
- Logs data in real time when possible, but often logs retrospectively
- Uses Garmin or similar devices for passive data
- Prefers low-friction, voice-based, and AI-assisted input

The system must not assume a single long-term goal or body recomposition focus.

---

## 2. Roles and Data Ownership

### 2.1 Roles

User:
- Logs workouts, meals, activities
- Uses presets and templates
- Defines and changes goals
- Views analytics, metabolism insights, and advice
- Can create custom food items and exercises

Admin (conceptual / future):
- Maintains canonical datasets
- Curates standard exercises, muscle groups, and food items
- Maintains default metabolic parameters

In version 1, user and admin are the same person and use the same interface. Role separation is conceptual only.

### 2.2 Food Item Ownership
- Canonical food items (system-defined)
- User-defined food items
- AI-generated food items (user-owned unless promoted later)
- User food items may override or extend canonical ones

---

## 3. App Structure and Navigation

Primary tabs:
- Overview
- Exercises
- Food
- Metabolism
- Insights / Advice
- Settings

The Metabolism tab is a first-class feature and conceptually links Exercises and Food.

---

## 4. Exercises Domain

### 4.1 Exercise Knowledge Layer

Exercise entity:
- Name
- Exercise type (flexible classification):
  - Weight-based
  - Bodyweight
  - Duration-based (e.g. plank, stretching)
- Equipment
- Movement pattern (push, pull, hinge, squat, carry, rotate)
- Classification:
  - Upper body
  - Lower body
  - Core
  - Full body
- Target muscles:
  - Primary
  - Secondary
  - Stabilizers

Exercises are reusable, extensible, and may be user-defined or canonical.

---

### 4.2 Muscle Model

Muscle entity:
- Name
- Muscle group (e.g. chest, back, legs)
- Region (upper body, lower body, core)

Used for:
- Session summaries
- Recovery estimation
- Load and balance analysis

---

### 4.3 Training Programs and Presets

Training program:
- Name
- Description
- List of training days
- Status: active or archived

Preset training day:
- Name (e.g. Upper Body Day 1)
- Ordered list of planned exercises
- Target parameters:
  - Sets
  - Reps or duration
  - Optional weight
- Notes

Preset evolution:
- Presets can be archived
- Workout sessions reference a snapshot of the preset
- Versioning is not required in v1, but archived presets must remain immutable

---

### 4.4 Workout Execution Layer

Workout session:
- Date
- Start timestamp
- End timestamp
- Linked preset snapshot (optional)
- Notes

A workout session is a container for all actions during a training period, not just exercises.

---

### 4.5 Session Items

A workout session consists of an ordered sequence of session items.

Session item types:
- Exercise set
- Warm-up activity
- Mobility or stretching
- Other activity
- Implicit rest

Each session item includes:
- Type
- Event timestamp(s)
- Optional reference (exercise or activity)

This allows non-linear execution, warm-ups, and realistic session reconstruction.

---

### 4.6 Set Logging Model

Logging principles:
- User does not need to press start
- User presses end set
- System infers start time and rest time

Set properties:
- Exercise reference
- Set type:
  - Warm-up
  - Working
  - Drop set
  - Failure
- Weight
- Repetitions or duration
- End timestamp
- Inferred start timestamp

Handling forgotten logging:
- Multiple sets logged later are distributed between last known event and current time
- Inferred timing is marked as estimated

---

### 4.7 Drop Sets and Complex Sets

Drop sets are modeled as:
- Multiple consecutive sets
- Same exercise
- Decreasing weight
- Minimal or no rest

UX:
- Set type selector: normal or drop set
- Drop set shows progression of sub-sets with weights and reps

No additional hierarchy beyond sets is required.

---

### 4.8 Workout Session Stop Logic

Explicit stop:
- User presses Stop Workout
- Session end timestamp is set

Implicit stop:
- If user forgets to stop, session auto-closes at:
  - Last logged set plus a buffer
  - Or start of next detected activity
- Session marked as auto-closed

User may later edit:
- End time
- Add missing sets or activities

---

### 4.9 Post-Workout Summary

Displayed after stopping a workout:
- Total duration
- Active vs rest time
- Muscles worked
- Estimated recovery time per muscle group
- Optional immediate advice

---

## 5. Food Domain

### 5.1 Food Knowledge Layer (Ingredients)

Food item:
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

---

### 5.2 Meals and Meal Classification

Meal template:
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

Meal instance:
- Timestamp
- Ingredients and quantities
- Meal category
- Notes
- Source:
  - Manual
  - AI-assisted

Beverages are logged as meals with category Beverage.

---

### 5.3 Complex Meals Without Extra Hierarchy

Meals composed of food and drinks are logged as multiple meal instances sharing a similar timestamp window. No nested meal hierarchy is used.

---

### 5.4 Barcode Support

Barcode use cases:
- Adding new food items
- Logging packaged foods
- Admin or canonical food creation

Flow:
- Scan barcode
- Lookup in internal or external databases
- Auto-fill nutrition data if found
- If not found, create draft food item with manual or AI-assisted completion

Barcode-derived items are editable and source-attributed.

---

### 5.5 AI-Assisted Food Logging

Supported inputs:
- Multiple photos (front, back, nutrition label, menu)
- Text notes
- Voice input
- Menu references

Output:
- Suggested ingredients
- Estimated quantities
- Confidence score
- Fully editable result

AI never finalizes without user confirmation.

---

## 6. Passive Activities and Non-Exercise Movement

Imported from Garmin:
- Walking
- Standing
- Long active periods (concerts, parties)

Used for:
- Energy expenditure
- Fatigue estimation
- Recovery modeling

User may annotate these activities.

---

## 7. Metabolism Domain

### 7.1 Purpose
Explain how food, exercise, sleep, and timing interact using simplified, educational models. No medical or diagnostic claims.

---

### 7.2 Inputs
- Meals and timing
- Exercises and activity
- Sleep quality and duration
- Body weight trends
- Declared goals

---

### 7.3 Modeled States (Estimated)
- Energy availability
- Glycogen status
- Insulin activity
- Recovery state
- Fatigue level

---

### 7.4 Outputs
- Current metabolic context
- Daily summaries
- Educational explanations
- Goal-adjusted interpretations

---

## 8. Advice and Recommendation System

### 8.1 Design Principles
- Context-aware
- Goal-aware
- Explainable
- Optional and non-intrusive
- Confidence-scored

---

### 8.2 Advice Triggers
- Morning
- Pre-workout
- Post-workout
- End of day

---

### 8.3 Advice Examples
- Poor sleep leading to adjusted training or nutrition
- Training-time-specific meal suggestions
- Recovery-focused recommendations
- Calorie pacing guidance based on remaining day

Advice always explains reasoning and assumptions.

---

## 9. AI-Assisted Workout Logging

### 9.1 Use Cases
- Group classes (HIIT, CrossFit)
- No phone during workout
- Post-hoc reconstruction
- Voice or text descriptions

---

### 9.2 Input Modes
- Voice dictation
- Typed free text
- Chat-style interaction

---

### 9.3 Parsing Flow
- User describes workout
- AI extracts exercises, structure, timing, and intensity
- Existing exercises are matched
- Missing exercises are suggested for creation
- User confirms and edits
- Workout session is created and marked as AI-assisted

---

### 9.4 Exercise Creation via AI
- AI proposes name, type, and muscle targets
- User confirms or edits
- Exercise saved as user-defined

---

## 10. Voice Input and Chat Interface

### 10.1 Voice Input
Voice input is supported for:
- Exercises
- Meals
- Notes
- AI-assisted logging

Voice is transcribed, parsed, and confirmed before saving.

---

### 10.2 Chat-Based Logging

A chat interface is available on the Overview tab.

Supported inputs:
- Descriptions of events or days
- Social activities
- Missed logs

System behavior:
- Converts chat input into structured events
- Cross-checks with Garmin data
- Requests clarification if needed

---

## 11. Time Handling and Editing

### 11.1 Event Time vs Log Time
All items support:
- Event timestamp
- Log timestamp

Missing event times are inferred and marked as estimated.

---

### 11.2 Retrospective Editing
Users can:
- Add missing workouts or meals
- Adjust timestamps
- Insert missed sets or activities

Estimated data is always labeled.

---

## 12. Future-Proofing and Periodization

The system must allow future support for:
- Training blocks
- Volume and intensity phases
- Deload weeks
- Progressive overload analysis

This requires:
- Preset archiving
- Session independence from presets
- Aggregatable volume metrics

No dedicated periodization UI is required in v1.

---

## 13. Data Principles

- Everything is timestamped
- Measured vs estimated data is clearly labeled
- User owns all data
- Data is exportable
- AI uncertainty is transparent

---

## 14. Version 1 Scope Summary

Included:
- Manual and AI-assisted logging
- Voice and chat input
- Barcode food entry
- Presets and free-form sessions
- Garmin integration
- Basic metabolism modeling
- Rule-based advice

Excluded:
- Medical claims
- Automatic decision-making
- Advanced periodization UI
- Multi-user support

---

## 15. Final Summary

This application is a flexible, human-tolerant fitness and nutrition system that supports real-time and retrospective logging, connects food and exercise through metabolism modeling, and provides explainable guidance while adapting to changing user goals.
