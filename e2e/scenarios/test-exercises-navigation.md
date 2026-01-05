# Exercises Page Navigation Scenarios

## Overview
Tests for verifying navigation between different sections of the exercises/workouts pages.

## Test Scenarios

### 1. Can login and access exercises page
**Given**: a user with valid credentials
**When**: the user logs in
**And**: navigates to `/workouts/library`
**Then**: the URL should contain `/workouts/library`

---

### 2. Navigates between workouts, presets, and exercises tabs
**Given**: a logged in user on the workouts page (`/workouts`)
**When**: the user clicks on the "Presets" tab
**Then**: the URL should change to `/workouts/presets`

**When**: the user clicks on the "Exercises" tab
**Then**: the URL should change to `/workouts/library`

**When**: the user clicks back to the "Workouts" tab
**Then**: the URL should change to `/workouts`

---

### 3. Exercises page displays content
**Given**: a logged in user
**When**: the user navigates to `/workouts/library`
**Then**: a heading with "Exercises" should be visible

---

### 4. Presets page displays content
**Given**: a logged in user
**When**: the user navigates to `/workouts/presets`
**Then**: the URL should be `/workouts/presets`
**And**: a heading with "Workout Presets" should be visible

---

### 5. Workouts page displays content
**Given**: a logged in user
**When**: the user navigates to `/workouts`
**Then**: the URL should be `/workouts`
**And**: some content should be visible (workout list, session list, or "start workout" option)
