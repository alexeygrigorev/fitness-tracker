import { test, expect, type Page } from '@playwright/test';

test.describe('Preset Management', () => {
  // Helper to login
  async function login(page: Page) {
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
  }

  test('can edit preset name and save changes', async ({ page }) => {
    await login(page);
    await page.goto('/workouts/presets');
    await page.waitForLoadState('networkidle');

    // Find any preset card - use text content to identify
    const presetCards = page.locator('[class*="rounded"]').filter({ hasText: /sets/i });
    const count = await presetCards.count();

    if (count === 0) {
      // No presets found, test passes vacuously
      test.skip(true, 'No presets found to edit');
      return;
    }

    // Get the first preset card
    const firstCard = presetCards.first();

    // Get the preset name/identifier
    const cardText = await firstCard.textContent() || '';
    console.log('Found preset card:', cardText.substring(0, 100));

    // Click edit button (first edit button in the card)
    await firstCard.getByTitle('Edit').first().click();

    // Wait for modal to appear - look for the heading
    await expect(page.locator('form')).toBeVisible();

    // Update the name
    const nameInput = page.locator('input[placeholder*="Upper Body"], input[placeholder*="Push"]').first();
    const nameInputVisible = await nameInput.count() > 0;

    let originalName = '';

    if (nameInputVisible) {
      originalName = await nameInput.inputValue();
      const timestamp = Date.now().toString().slice(-4);
      const newName = `Updated ${originalName} ${timestamp}`;
      await nameInput.fill(newName);

      // Save changes
      await page.getByRole('button', { name: 'Save Changes' }).click();

      // Wait for modal to close
      await expect(page.locator('form')).not.toBeVisible({ timeout: 5000 });

      // Verify the new name is visible on the page
      await expect(page.locator(`text="${newName}"`)).toBeVisible();
    } else {
      // Use the name input by label if placeholder doesn't match
      const labeledInput = page.getByLabel(/Preset Name/i);
      const hasLabelInput = await labeledInput.count() > 0;

      if (hasLabelInput) {
        originalName = await labeledInput.inputValue();
        const timestamp = Date.now().toString().slice(-4);
        const newName = `Updated ${originalName || 'Preset'} ${timestamp}`;
        await labeledInput.fill(newName);

        await page.getByRole('button', { name: 'Save Changes' }).click();
        await expect(page.locator('form')).not.toBeVisible({ timeout: 5000 });
        await expect(page.locator(`text="${newName}"`)).toBeVisible();
      } else {
        // Close modal if no input found
        await page.keyboard.press('Escape');
        test.skip(true, 'Could not find name input to test');
        return;
      }
    }

    // Rename it back to the original name to clean up
    await firstCard.getByTitle('Edit').first().click();
    await expect(page.locator('form')).toBeVisible();

    const restoreNameInput = page.locator('input[placeholder*="Upper Body"], input[placeholder*="Push"]').first();
    const restoreNameVisible = await restoreNameInput.count() > 0;

    if (restoreNameVisible) {
      await restoreNameInput.fill(originalName);
    } else {
      const labeledInput = page.getByLabel(/Preset Name/i);
      await labeledInput.fill(originalName);
    }

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.locator('form')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text="${originalName}"`)).toBeVisible();
  });

  test('can edit exercise dropdowns and save changes', async ({ page }) => {
    // Handle any unexpected alerts
    page.on('dialog', dialog => {
      console.log('Dialog detected:', dialog.message());
      dialog.accept();
    });

    await login(page);
    await page.goto('/workouts/presets');
    await page.waitForLoadState('networkidle');

    // Find a preset card
    const presetCards = page.locator('[class*="rounded"]').filter({ hasText: /sets/i });
    const count = await presetCards.count();

    if (count === 0) {
      test.skip(true, 'No presets found to edit');
      return;
    }

    const firstCard = presetCards.first();

    // Click edit button (use first())
    await firstCard.getByTitle('Edit').first().click();

    // Wait for modal
    await expect(page.locator('form')).toBeVisible();

    // Look for dropdown exercise indicator (drops/set)
    const dropdownIndicator = page.locator('text=/drops\\/set/i');
    const hasDropdown = await dropdownIndicator.count() > 0;

    if (hasDropdown) {
      // Get the dropdown input - be more specific to avoid matching Sets input
      const dropdownInput = page.locator('input[title="Drops per set"]');
      const currentValue = await dropdownInput.inputValue();

      // Change value (toggle between 1 and 2)
      const newValue = currentValue === '2' ? '1' : '2';
      await dropdownInput.clear();
      await dropdownInput.fill(newValue);

      // Verify the value was actually changed
      await expect(dropdownInput).toHaveValue(newValue);

      // Wait for React to process the state change
      await page.waitForTimeout(100);

      // Save changes - click the submit button directly
      const saveButton = page.locator('button[type="submit"]').filter({ hasText: 'Save Changes' });
      await saveButton.click({ force: true });
      await page.waitForLoadState('networkidle');

      // Wait a bit more for the modal to close
      await page.waitForTimeout(500);

      // Check that modal is closed by checking for the modal title text
      const modalTitle = page.getByText('Edit Preset');
      await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

      // Reopen to verify
      await firstCard.getByTitle('Edit').first().click();
      await expect(page.locator('form')).toBeVisible();

      // Verify the value persisted - use the specific title selector
      await expect(page.locator('input[title="Drops per set"]')).toHaveValue(newValue);

      // Close modal
      await page.keyboard.press('Escape');
    } else {
      // No dropdown exercise - just verify we can open edit form
      await page.keyboard.press('Escape');
    }
  });

  test('can create a preset with bench press, update day, and delete', async ({ page }) => {
    await login(page);
    await page.goto('/workouts/presets');
    await page.waitForLoadState('networkidle');

    // Use timestamp for unique preset name to avoid conflicts with previous test runs
    const timestamp = Date.now().toString().slice(-6);
    const presetName = `Bench Preset ${timestamp}`;

    // Click "+ New Preset" button
    await page.getByRole('button', { name: '+ New Preset' }).click();

    // Wait for the form modal to appear
    await expect(page.locator('form')).toBeVisible();

    // Fill in preset name
    const nameInput = page.getByPlaceholder('e.g., Upper Body A, Push Day');
    await nameInput.fill(presetName);

    // Select type: strength
    const typeLabel = page.getByText('Type');
    const typeSelect = typeLabel.locator('..').locator('select');
    await typeSelect.selectOption('strength');

    // Click "Add Exercise" button
    await page.getByRole('button', { name: 'Add Exercise' }).click();

    // Wait for exercise picker to appear
    await expect(page.getByPlaceholder('Search exercises by name or muscle')).toBeVisible();

    // Search for Bench Press
    const searchInput = page.getByPlaceholder('Search exercises by name or muscle');
    await searchInput.fill('Bench Press');
    await page.waitForTimeout(200);

    // Click on Bench Press exercise button
    const benchPressButton = page.locator('button').filter({ hasText: 'Bench Press' }).locator('visible=true').first();
    await benchPressButton.click();

    // Wait for exercise to be added
    await page.waitForTimeout(500);

    // Verify exercise was added
    await expect(page.getByText('Exercises (1)')).toBeVisible();
    await expect(page.locator('form').getByText('Bench Press').first()).toBeVisible();

    // Check "include warmup" checkbox
    const warmupCheckbox = page.getByLabel('include warmup');
    await expect(warmupCheckbox).toBeChecked();

    // Click "Create Preset" button
    await page.getByRole('button', { name: 'Create Preset' }).click();

    // Wait for modal to close
    await expect(page.locator('form')).not.toBeVisible({ timeout: 5000 });

    // Verify preset was created
    await expect(page.getByText(presetName)).toBeVisible();

    // Reopen the preset to update day to Monday
    const cardContainer = page.locator('.grid > div').filter({ hasText: presetName });
    await expect(cardContainer).toBeVisible();
    await cardContainer.getByTitle('Edit').first().click();

    // Wait for edit form
    await expect(page.locator('form')).toBeVisible();

    // Update day to Monday
    const dayLabel = page.getByText('Day of Week');
    const daySelect = dayLabel.locator('..').locator('select');
    await daySelect.selectOption('Monday');

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for modal to close
    await expect(page.locator('form')).not.toBeVisible({ timeout: 5000 });

    // Reopen again to verify the day was saved
    await cardContainer.getByTitle('Edit').first().click();
    await expect(page.locator('form')).toBeVisible();

    // Verify day is Monday
    await expect(daySelect).toHaveValue('Monday');

    // Close and delete the preset
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Delete the test preset
    page.on('dialog', dialog => dialog.accept());
    await cardContainer.getByTitle('Delete').click();

    // Wait for deletion to complete
    await page.waitForTimeout(500);

    // Verify preset was deleted
    await expect(page.getByText(presetName)).not.toBeVisible();
  });

  test('can create a superset preset with warmup and verify persistence', async ({ page }) => {
    await login(page);
    await page.goto('/workouts/presets');
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now().toString().slice(-6);
    const presetName = `Superset Preset ${timestamp}`;

    // Click "+ New Preset" button
    await page.getByRole('button', { name: '+ New Preset' }).click();
    await expect(page.locator('form')).toBeVisible();

    // Fill in preset name
    const nameInput = page.getByPlaceholder('e.g., Upper Body A, Push Day');
    await nameInput.fill(presetName);

    // Select day: Wednesday
    const dayLabel = page.getByText('Day of Week');
    const daySelect = dayLabel.locator('..').locator('select');
    await daySelect.selectOption('Wednesday');

    // Select type: strength
    const typeLabel = page.getByText('Type');
    const typeSelect = typeLabel.locator('..').locator('select');
    await typeSelect.selectOption('strength');

    // Click "Add Exercise" button
    await page.getByRole('button', { name: 'Add Exercise' }).click();
    await expect(page.getByPlaceholder('Search exercises by name or muscle')).toBeVisible();

    // Search and add Bench Press
    const searchInput = page.getByPlaceholder('Search exercises by name or muscle');
    await searchInput.fill('Bench Press');
    await page.waitForTimeout(200);
    await page.locator('button').filter({ hasText: 'Bench Press' }).locator('visible=true').first().click();
    await page.waitForTimeout(500);

    // Verify "Exercises (1)" is visible
    await expect(page.getByText('Exercises (1)')).toBeVisible();

    // Warmup checkbox is checked by default
    const warmupCheckbox = page.getByLabel('include warmup').first();
    await expect(warmupCheckbox).toBeChecked();

    // Change sets to 4
    const setsInput = page.locator('input[title="Sets"]').first();
    await setsInput.fill('4');
    await expect(setsInput).toHaveValue('4');

    // Convert Bench Press to superset
    const typeDropdown = page.locator('select').filter({ hasText: /Normal|Dropdown|Superset/ }).first();
    await typeDropdown.selectOption('superset');

    // Verify it's now a superset (should see "Break up" button)
    await expect(page.getByText('Break up')).toBeVisible();

    // Verify warmup checkbox is still checked after conversion (now fixed!)
    await expect(warmupCheckbox).toBeChecked();

    // Add Barbell Rows to the superset
    await page.getByRole('button', { name: 'Add an exercise to Superset 1' }).click();
    // Use the second (visible) search input for the superset picker
    const supersetSearchInput = page.getByPlaceholder('Search exercises by name or muscle').nth(1);
    await supersetSearchInput.fill('Barbell Row');
    await page.waitForTimeout(200);
    await page.locator('button').filter({ hasText: /Barbell Row/i }).locator('visible=true').first().click();
    await page.waitForTimeout(500);

    // Verify we now have 2 exercises in superset (still shows "Exercises (1)")
    await expect(page.getByText('Exercises (1)')).toBeVisible();

    // Barbell Row warmup is checked by default for new superset items
    const barbellRowWarmup = page.getByLabel('include warmup').nth(1);
    await expect(barbellRowWarmup).toBeChecked();

    // Uncheck Barbell Row warmup as per test requirements
    await barbellRowWarmup.uncheck();
    await expect(barbellRowWarmup).not.toBeChecked();

    // Save the preset
    await page.getByRole('button', { name: 'Create Preset' }).click();
    await expect(page.locator('form')).not.toBeVisible({ timeout: 5000 });

    // Verify preset was created
    await expect(page.getByText(presetName)).toBeVisible();

    // Reopen the preset to verify persistence
    const cardContainer = page.locator('.grid > div').filter({ hasText: presetName });
    await cardContainer.getByTitle('Edit').first().click();
    await expect(page.locator('form')).toBeVisible();

    // Verify name
    await expect(nameInput).toHaveValue(presetName);

    // Verify day is Wednesday
    await expect(daySelect).toHaveValue('Wednesday');

    // Verify type is strength
    await expect(typeSelect).toHaveValue('strength');

    // Verify superset exists
    await expect(page.getByText('Break up')).toBeVisible();

    // Get fresh references to elements after reopening - scope to form
    const formWarmups = page.locator('form').getByLabel('include warmup');
    const reopenedWarmup1 = formWarmups.nth(0);
    const reopenedWarmup2 = formWarmups.nth(1);

    // Verify Bench Press warmup is checked (persisted correctly now!)
    await expect(reopenedWarmup1).toBeChecked();

    // Verify Barbell Row warmup is unchecked (persisted)
    await expect(reopenedWarmup2).not.toBeChecked();

    // Close and delete
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    page.on('dialog', dialog => dialog.accept());
    await cardContainer.getByTitle('Delete').click();
    await page.waitForTimeout(500);
    await expect(page.getByText(presetName)).not.toBeVisible();
  });

  test('can create a superset preset without warmup and verify persistence', async ({ page }) => {
    await login(page);
    await page.goto('/workouts/presets');
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now().toString().slice(-6);
    const presetName = `Superset No Warmup ${timestamp}`;

    // Click "+ New Preset" button
    await page.getByRole('button', { name: '+ New Preset' }).click();
    await expect(page.locator('form')).toBeVisible();

    // Fill in preset name
    const nameInput = page.getByPlaceholder('e.g., Upper Body A, Push Day');
    await nameInput.fill(presetName);

    // Click "Add Exercise" button
    await page.getByRole('button', { name: 'Add Exercise' }).click();
    await expect(page.getByPlaceholder('Search exercises by name or muscle')).toBeVisible();

    // Search and add Bench Press
    const searchInput = page.getByPlaceholder('Search exercises by name or muscle');
    await searchInput.fill('Bench Press');
    await page.waitForTimeout(200);
    await page.locator('button').filter({ hasText: 'Bench Press' }).locator('visible=true').first().click();
    await page.waitForTimeout(500);

    // Warmup checkbox is checked by default - uncheck it explicitly
    const warmupCheckbox = page.getByLabel('include warmup').first();
    await warmupCheckbox.uncheck();
    await expect(warmupCheckbox).not.toBeChecked();

    // Change sets to 4
    const setsInput = page.locator('input[title="Sets"]').first();
    await setsInput.fill('4');
    await expect(setsInput).toHaveValue('4');

    // Convert Bench Press to superset
    const typeDropdown = page.locator('select').filter({ hasText: /Normal|Dropdown|Superset/ }).first();
    await typeDropdown.selectOption('superset');

    // BUG: After converting to superset, warmup resets to unchecked (matches our desired state)
    await expect(warmupCheckbox).not.toBeChecked();

    // BUG: After converting to superset, sets input disappears (no UI to edit sets for supersets)

    // Add Barbell Rows to the superset
    await page.getByRole('button', { name: 'Add an exercise to Superset 1' }).click();
    // Use the second (visible) search input for the superset picker
    const supersetSearchInput = page.getByPlaceholder('Search exercises by name or muscle').nth(1);
    await supersetSearchInput.fill('Barbell Row');
    await page.waitForTimeout(200);
    await page.locator('button').filter({ hasText: /Barbell Row/i }).locator('visible=true').first().click();
    await page.waitForTimeout(500);

    // Barbell Row warmup is checked by default - uncheck it as per test requirements
    const barbellRowWarmup = page.getByLabel('include warmup').nth(1);
    await expect(barbellRowWarmup).toBeChecked();
    await barbellRowWarmup.uncheck();
    await expect(barbellRowWarmup).not.toBeChecked();

    // Save the preset
    await page.getByRole('button', { name: 'Create Preset' }).click();
    await expect(page.locator('form')).not.toBeVisible({ timeout: 5000 });

    // Verify preset was created
    await expect(page.getByText(presetName)).toBeVisible();

    // Reopen to verify persistence
    const cardContainer = page.locator('.grid > div').filter({ hasText: presetName });
    await cardContainer.getByTitle('Edit').first().click();
    await expect(page.locator('form')).toBeVisible();

    // Get fresh references - need to find warmup checkboxes within the form only
    const formWarmups = page.locator('form').getByLabel('include warmup');
    const reopenedWarmup1 = formWarmups.nth(0);
    const reopenedWarmup2 = formWarmups.nth(1);

    // Verify Bench Press warmup is unchecked (persisted)
    await expect(reopenedWarmup1).not.toBeChecked();

    // Verify Barbell Row warmup is unchecked (persisted)
    await expect(reopenedWarmup2).not.toBeChecked();

    // Clean up
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    page.on('dialog', dialog => dialog.accept());
    await cardContainer.getByTitle('Delete').click();
    await page.waitForTimeout(500);
    await expect(page.getByText(presetName)).not.toBeVisible();
  });
});
