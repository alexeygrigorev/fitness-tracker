# Active Workout Persistence Scenarios

## Overview
Tests for verifying that active workout state persists across page refreshes and different browser sessions/devices.

## Test Scenarios

### 1. Active workout persists across page refresh
**Given**: a user is logged in and starts a Push Day workout on Monday
**When**: the user completes one dropdown set of Bench Press (with weights and reps)
**And**: the workout session ID is set on the active workout container
**And**: the user refreshes the page
**Then**: the active workout should still be visible
**And**: the completed set should still be marked as completed (Uncomplete button visible)
**And**: the workout should have the same workout ID

**Critical**: The active workout state must be persisted on the server, not just in browser storage.

---

### 2. Active workout persists across different devices/sessions
**Given**: User 1 starts a Push Day workout on Device 1
**And**: completes one dropdown set of Bench Press
**When**: User 2 logs in on a different device/context with the same account
**Then**: the active workout should be visible on Device 2
**And**: the completed set should be marked as completed on Device 2

**When**: User 2 finishes the workout on Device 2
**And**: User 1 refreshes their page on Device 1
**Then**: the workout should no longer be active on Device 1

**Purpose**: Tests that workout state is synchronized across multiple devices/sessions via server persistence.
