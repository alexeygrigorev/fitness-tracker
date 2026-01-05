# Monday Push Day Workout Scenarios

## Overview
End-to-end tests for completing a full Push Day workout on Monday, including realistic delays between sets and verifying the workout is properly logged.

## Test Scenarios

### 1. Completes full Push Day workout on Monday with realistic delays
**Given**: a user is logged in and it is Monday morning
**And**: the Push Day preset is available
**When**: the user starts the Push Day workout
**And**: completes the first dropdown set of Bench Press (W: 60kg, D1: 57.5kg, D2: 55kg × 10 reps each)
**And**: waits 2 minutes (simulating rest period)
**And**: completes a second dropdown set of Bench Press with the same weights
**And**: waits 2 minutes
**And**: completes one set of Overhead Press (30kg × 8 reps)
**And**: finishes the workout
**Then**: the workout should appear in the logged workouts list with time "09:00"

---

### 2. Can finish workout with partial/incomplete sets
**Given**: a user is logged in and starts a Push Day workout
**When**: the user completes only ONE dropdown set of Bench Press
**And**: finishes the workout (with remaining sets incomplete)
**Then**: the workout should be saved to the logged workouts list
**And**: the workout should show "09:00" as the time

---

### 3. Push Day is highlighted on Monday among other presets
**Given**: a user is logged in and it is Monday
**When**: the user navigates to the workouts page
**Then**: the "Today's Presets" section should be visible
**And**: Push Day should be highlighted/visible in the Today's section

---

### 4. Non-Monday presets are in "Other days" section on Monday
**Given**: a user is logged in and it is Monday
**When**: the user navigates to the workouts page
**Then**: Leg Day (a Friday preset) should exist in the DOM
**And**: it is in a collapsible "Other days" section

---

### 5. Can resume a partially completed workout and finish remaining sets
**Given**: a user previously started and finished a Push Day workout with only 1 set completed
**When**: the user clicks the play button to resume the workout
**Then**: the active workout mode should appear again
**And**: the previously completed set should still be marked as completed (Uncomplete button visible)
**And**: all sets from the original workout should be visible (not just 3)
**When**: the user finishes the workout again
**Then**: the workout should be updated (not duplicated)
**And**: deleting the workout should remove it from the list

---

### 6. Resuming and finishing workout updates instead of duplicating
**Given**: a user starts and finishes a Push Day workout with 1 set completed
**When**: the user resumes the workout
**And**: completes a second set
**And**: finishes the workout again
**Then**: only ONE workout should exist in the list (not two)
**And**: the workout should have been updated with the new set data

---

### 7. Dropdown set increments counter by one not by number of dropdowns
**Given**: a user starts a Push Day workout
**And**: the workout shows "0/18 sets" (or similar counter)
**When**: the user completes ONE dropdown set row
**Then**: the counter should increment by 1 (e.g., "1/18 sets")
**And**: NOT by 3 (the number of dropdown sub-sets: W + D1 + D2)

**Critical**: This tests a bug where dropdown sets were incrementing the counter by the number of sub-sets instead of by 1.

---

### 8. Deleting a resumed workout removes it from the list
**Given**: a user creates and finishes a workout
**When**: the user resumes the workout
**And**: deletes the workout using the delete button
**Then**: the active workout should disappear
**And**: the workout should be removed from the workout list
**And**: the workout count should decrease by 1

---

### 9. Remembers and updates last used weights across sessions
**Given**: a user logs an Overhead Press set with 25kg × 6 reps in Week 1
**When**: the user clears all storage (cookies, localStorage, sessionStorage)
**And**: logs in again in Week 2
**And**: starts the same workout
**Then**: the Overhead Press inputs should remember 25kg × 6 reps

**When**: the user logs the set with increased weight (27kg × 8 reps)
**And**: clears storage again
**And**: logs in again in Week 3
**Then**: the inputs should remember 27kg × 8 reps (the most recent values)
**And**: NOT the original 25kg from Week 1

**Purpose**: Tests progressive overload - the system should remember the last used weights per exercise.
