# User Isolation Scenarios

## Overview
Tests for verifying that users can only see their own workouts - data isolation between users.

## Test Scenarios

### 1. Users cannot see each other's workouts
**Given**: User 1 ("test") is logged in
**When**: User 1 starts and finishes a Push Day workout on Monday
**And**: the workout appears in User 1's workout list with a unique workout ID
**And**: User 1 logs out
**And**: User 2 ("test2") logs in
**Then**: User 2 should NOT see User 1's workout (by workout ID)
**And**: none of User 2's workouts should have User 1's workout ID

**Purpose**: Ensures data privacy - users' workout data is properly isolated by user account.
