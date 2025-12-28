# Exercises Domain

## Exercise Knowledge Layer

### Exercise Entity

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

## Muscle Model

### Muscle Entity

- Name
- Muscle group (e.g. chest, back, legs)
- Region (upper body, lower body, core)

Used for:
- Session summaries
- Recovery estimation
- Load and balance analysis

## Training Programs and Presets

### Training Program

- Name
- Description
- List of training days
- Status: active or archived

### Preset Training Day

- Name (e.g. Upper Body Day 1)
- Ordered list of planned exercises
- Target parameters:
  - Sets
  - Reps or duration
  - Optional weight
- Notes

### Preset Evolution

- Presets can be archived
- Workout sessions reference a snapshot of the preset
- Versioning is not required in v1, but archived presets must remain immutable

## Workout Execution Layer

### Workout Session

- Date
- Start timestamp
- End timestamp
- Linked preset snapshot (optional)
- Notes

A workout session is a container for all actions during a training period, not just exercises.

## Session Items

A workout session consists of an ordered sequence of session items.

### Session Item Types

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

## Set Logging Model

### Logging Principles

- User does not need to press start
- User presses end set
- System infers start time and rest time

### Set Properties

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

### Handling Forgotten Logging

- Multiple sets logged later are distributed between last known event and current time
- Inferred timing is marked as estimated

## Drop Sets and Complex Sets

Drop sets are modeled as:
- Multiple consecutive sets
- Same exercise
- Decreasing weight
- Minimal or no rest

### UX

- Set type selector: normal or drop set
- Drop set shows progression of sub-sets with weights and reps

No additional hierarchy beyond sets is required.

## Workout Session Stop Logic

### Explicit Stop

- User presses Stop Workout
- Session end timestamp is set

### Implicit Stop

- If user forgets to stop, session auto-closes at:
  - Last logged set plus a buffer
  - Or start of next detected activity
- Session marked as auto-closed

User may later edit:
- End time
- Add missing sets or activities

## Post-Workout Summary

Displayed after stopping a workout:
- Total duration
- Active vs rest time
- Muscles worked
- Estimated recovery time per muscle group
- Optional immediate advice
