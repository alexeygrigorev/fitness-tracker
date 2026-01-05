# Preset Management Scenarios

## Overview
Tests for managing workout presets - editing names, dropdown settings, and day assignments.

## Test Scenarios

### 1. Can edit preset name and save changes
**Given**: a logged in user with existing presets
**When**: the user navigates to the presets page
**And**: clicks the edit button on a preset card
**And**: updates the preset name
**And**: clicks "Save Changes"
**Then**: the modal should close
**And**: the new name should be visible on the page

**Cleanup**: The test restores the original name after verification.

---

### 2. Can edit exercise dropdowns and save changes
**Given**: a logged in user with a preset that has dropdown exercises
**When**: the user opens the edit modal for the preset
**And**: changes the "Drops per set" value (toggle between 1 and 2)
**And**: clicks "Save Changes"
**Then**: the modal should close
**And**: reopening the modal should show the updated value

**Note**: If the preset has no dropdown exercises, the test just verifies the edit form can be opened.

---

### 3. Can update preset day to Monday and verify
**Given**: a logged in user with a preset (Push Day, Pull Day, or Leg Day)
**When**: the user opens the edit modal for the preset
**And**: changes the "Day of Week" dropdown to "Monday"
**And**: clicks "Save Changes"
**Then**: the modal should close
**And**: reloading the page should show Monday is still selected

**Cleanup**: The test restores the original day value after verification.
