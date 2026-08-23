# User Isolation Scenarios

## Overview
Tests for verifying that users can only see their own workouts - data isolation between users.

## Test Scenarios

### 1. Users cannot see each other's workouts
**Given**: two uniquely registered users are created for the test run
**When**: the owner seeds a private exercise, preset, and completed workout through the API
**And**: the workout appears in User 1's workout list with a unique workout ID
**And**: each user opens the workout page in its own browser context
**Then**: User 2 should NOT see User 1's workout (by workout ID)
**And**: none of User 2's rendered content should contain User 1's unique marker

**Purpose**: Ensures data privacy - users' workout data is properly isolated by user account.
