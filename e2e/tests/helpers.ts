import { type Page } from '@playwright/test';

/**
 * Login helper - authenticates the test user
 */
export async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your username').fill('test');
  await page.getByPlaceholder('Enter your password').fill('test');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
}

/**
 * Clear any existing active workout from the UI
 */
async function clearUIActiveWorkout(page: Page) {
  const existingActiveWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
  const hasExistingWorkout = await existingActiveWorkout.isVisible().catch(() => false);
  if (hasExistingWorkout) {
    const deleteButton = page.locator('button[title="Delete workout"]');
    await deleteButton.click();
    await existingActiveWorkout.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Clear all unfinished backend sessions via API
 * This is important for test isolation - old sessions can interfere with new tests
 */
export async function clearAllBackendSessions(page: Page) {
  const result = await page.evaluate(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      return { cleared: 0, error: 'No token found' };
    }

    try {
      // Get all sessions
      const resp = await fetch('/api/workouts/sessions/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!resp.ok) {
        return { cleared: 0, error: `Failed to fetch sessions: ${resp.status}` };
      }

      const sessions = await resp.json();

      // Finish all unfinished sessions
      let clearedCount = 0;
      for (const session of sessions) {
        if (!session.endedAt) {
          await fetch(`/api/workouts/sessions/${session.id}/finish/`, {
            method: 'POST',  // Backend expects POST, not PATCH
            headers: { 'Authorization': `Bearer ${token}` }
          });
          clearedCount++;
        }
      }

      return { cleared: clearedCount, totalSessions: sessions.length };
    } catch (e) {
      return { cleared: 0, error: String(e) };
    }
  });

  console.log('[Session Cleanup] Backend sessions cleared:', result);
  return result;
}

/**
 * Complete cleanup: clear both backend sessions and UI active workout
 * Call this before starting a new workout to ensure clean state
 */
export async function clearAllWorkoutState(page: Page) {
  // First clear any backend sessions
  await clearAllBackendSessions(page);

  // Then clear any UI-visible active workout
  await clearUIActiveWorkout(page);
}

/**
 * Ensure the test user has workout presets by creating them from templates if needed
 * This is important for tests that expect to find presets like "Push Day"
 */
export async function ensureTestPresets(page: Page): Promise<void> {
  const result = await page.evaluate(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      return { error: 'No token found' };
    }

    try {
      // Get existing user presets
      const presetsResp = await fetch('/api/workouts/presets/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!presetsResp.ok) {
        return { error: `Failed to fetch presets: ${presetsResp.status}` };
      }

      const userPresets = await presetsResp.json();

      // Check if user already has a "Push Day" preset (case-insensitive, contains "push")
      const pushDayPreset = userPresets.find((p: any) =>
        p.name && p.name.toLowerCase().includes('push')
      );

      if (pushDayPreset) {
        // Check if the Bench Press exercise has dropdowns=2
        const benchPress = pushDayPreset.exercises?.find((e: any) => e.exerciseName?.toLowerCase().includes('bench'));
        if (benchPress && benchPress.type === 'dropdown') {
          // If dropdowns is not 2, update it
          if (benchPress.dropdowns !== 2) {
            await fetch(`/api/workouts/presets/${pushDayPreset.id}/`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                exercises: pushDayPreset.exercises.map((e: any) => {
                  if (e.exerciseName?.toLowerCase().includes('bench') && e.type === 'dropdown') {
                    return { ...e, dropdowns: 2 };
                  }
                  return e;
                })
              })
            });
            // Return a flag to indicate the preset was updated
            return { created: 0, updated: true, message: 'Updated Push Day preset dropdowns to 2' };
          }
        }
        return { created: 0, updated: false, message: 'Test user already has Push Day preset with correct dropdowns' };
      }

      // Get templates
      const templatesResp = await fetch('/api/workouts/presets/templates/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!templatesResp.ok) {
        return { error: `Failed to fetch templates: ${templatesResp.status}` };
      }

      const templates = await templatesResp.json();

      // Find Push Day template and create a copy for the user
      const pushDayTemplate = templates.find((t: any) =>
        t.name && t.name.toLowerCase().includes('push')
      );

      if (!pushDayTemplate) {
        return { error: 'Push Day template not found' };
      }

      // Create preset from template
      const createResp = await fetch('/api/workouts/presets/create_from_template/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ template_id: pushDayTemplate.id })
      });

      if (!createResp.ok) {
        return { error: `Failed to create preset from template: ${createResp.status}` };
      }

      const createdPreset = await createResp.json();

      return {
        created: 1,
        message: `Created preset "${createdPreset.name}" from template`,
        preset: createdPreset
      };
    } catch (e) {
      return { error: String(e) };
    }
  });

  console.log('[Test Presets] Result:', result);

  if (result.error) {
    throw new Error(`Failed to ensure test presets: ${result.error}`);
  }

  // Reload the page to pick up the new preset
  await page.goto('/workouts');
  await page.waitForLoadState('networkidle');
}

/**
 * Find and click a preset by name
 * First looks in "Today's Presets" (green border), then in "Other days" section (gray border)
 */
export async function findAndClickPreset(page: Page, presetName: string | RegExp): Promise<void> {
  // First try to find in Today's presets (green border)
  const todayPreset = page.locator('.border-2.border-green-400').filter({ hasText: presetName }).first();
  const todayCount = await todayPreset.count();

  if (todayCount > 0) {
    await todayPreset.click();
    return;
  }

  // Not in Today's presets - check Other days section
  // Click the "Other days" details/summary to expand it
  const otherDaysSummary = page.getByText('Other days');
  const isExpanded = await otherDaysSummary.getAttribute('open');

  if (!isExpanded) {
    await otherDaysSummary.click();
    await page.waitForTimeout(300);
  }

  // Find the preset in Other days section (gray border)
  const otherDaysPreset = page.locator('details[open] .border.border-gray-200').filter({ hasText: presetName }).first();
  await otherDaysPreset.click();
}
