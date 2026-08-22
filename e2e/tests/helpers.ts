import { type Page } from '@playwright/test';

type BackendSession = {
  id: number;
  endedAt?: string | null;
};

async function getStoredAuthHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) {
    throw new Error('No authentication token found');
  }

  return { Authorization: `Bearer ${token}` };
}

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:8000';

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
  const request = page.context().request;
  const headers = await getStoredAuthHeaders(page);
  const listResponse = await request.get(`${API_BASE}/api/workouts/sessions/`, { headers });
  if (!listResponse.ok()) {
    throw new Error(`Failed to fetch sessions: ${listResponse.status()}`);
  }

  const sessions = (await listResponse.json()) as BackendSession[];
  let clearedCount = 0;
  for (const session of sessions.filter((candidate) => !candidate.endedAt)) {
    const finishResponse = await request.post(
      `${API_BASE}/api/workouts/sessions/${session.id}/finish/`,
      { headers },
    );
    if (!finishResponse.ok()) {
      throw new Error(`Failed to finish session ${session.id}: ${finishResponse.status()}`);
    }

    clearedCount += 1;
  }

  return { cleared: clearedCount, totalSessions: sessions.length };
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
  type PresetExercise = {
    exerciseName?: string;
    dropdowns?: number;
    type?: string;
  };
  type WorkoutPresetSummary = {
    id: number;
    name: string;
    exercises?: PresetExercise[];
  };

  const request = page.context().request;
  const headers = await getStoredAuthHeaders(page);
  const presetsResponse = await request.get(`${API_BASE}/api/workouts/presets/`, { headers });
  if (!presetsResponse.ok()) {
    throw new Error(`Failed to fetch presets: ${presetsResponse.status()}`);
  }

  const userPresets = (await presetsResponse.json()) as WorkoutPresetSummary[];
  const pushDayPreset = userPresets.find((preset) =>
    preset.name.toLowerCase().includes('push'),
  );

  if (pushDayPreset) {
    const benchPress = pushDayPreset.exercises?.find((exercise) =>
      exercise.exerciseName?.toLowerCase().includes('bench'),
    );

    if (benchPress?.type === 'dropdown' && benchPress.dropdowns !== 2) {
      const exercises = pushDayPreset.exercises?.map((exercise) =>
        exercise === benchPress ? { ...exercise, dropdowns: 2 } : exercise,
      ) ?? [];
      const updateResponse = await request.patch(
        `${API_BASE}/api/workouts/presets/${pushDayPreset.id}/`,
        { headers, data: { exercises } },
      );
      if (!updateResponse.ok()) {
        throw new Error(`Failed to update Push Day preset: ${updateResponse.status()}`);
      }
    }

    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');
    return;
  }

  const templatesResponse = await request.get(
    `${API_BASE}/api/workouts/presets/templates/`,
    { headers },
  );
  if (!templatesResponse.ok()) {
    throw new Error(`Failed to fetch templates: ${templatesResponse.status()}`);
  }

  const templates = (await templatesResponse.json()) as Array<{ id: number; name: string }>;
  const pushDayTemplate = templates.find((template) =>
    template.name.toLowerCase().includes('push'),
  );
  if (!pushDayTemplate) {
    throw new Error('Push Day template not found');
  }

  const createResponse = await request.post(
    `${API_BASE}/api/workouts/presets/create_from_template/`,
    {
      headers,
      data: { template_id: pushDayTemplate.id },
    },
  );
  if (!createResponse.ok()) {
    throw new Error(`Failed to create preset from template: ${createResponse.status()}`);
  }

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
