import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE_URL = process.env.VITE_API_URL || 'http://127.0.0.1:8000';

test.describe('Exercise library CRUD', () => {
  const timestamp = Date.now();
  const namePrefix = `E2E Library ${timestamp}`;

  async function login(page: Page) {
    await page.goto('/login');
    await page.getByLabel('Username').fill('test');
    await page.getByLabel('Password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10_000 });
  }

  async function openLibrary(page: Page) {
    await page.goto('/workouts/library');
    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();
  }

  function exerciseRows(page: Page, name: string) {
    return page
      .locator('div.p-3.rounded-lg.border')
      .filter({ has: page.getByText(name, { exact: true }) });
  }

  function exerciseDetails(page: Page) {
    return page.locator('div.hidden.md\\:grid > div').nth(1);
  }

  function exerciseNameInput(form: ReturnType<Page['locator']>) {
    return form.getByPlaceholder('e.g., Barbell Bench Press', { exact: true });
  }

  async function deleteMatchingExercises(request: APIRequestContext) {
    const loginResponse = await request.post(`${API_BASE_URL}/api/auth/login/`, {
      form: { username: 'test', password: 'test' },
    });
    if (!loginResponse.ok()) {
      throw new Error(`Unable to authenticate for cleanup: ${loginResponse.status()}`);
    }

    const { access } = (await loginResponse.json()) as { access: string };
    const headers = { Authorization: `Bearer ${access}` };
    const listResponse = await request.get(`${API_BASE_URL}/api/workouts/exercises/`, { headers });
    if (!listResponse.ok()) {
      throw new Error(`Unable to list exercises for cleanup: ${listResponse.status()}`);
    }

    const exercises = (await listResponse.json()) as Array<{ id: number; name: string }>;
    const matchingIds = exercises
      .filter((exercise) => exercise.name.startsWith(namePrefix))
      .map((exercise) => exercise.id);

    const deleteResponses = await Promise.all(
      matchingIds.map((id) =>
        request.delete(`${API_BASE_URL}/api/workouts/exercises/${id}/`, { headers }),
      ),
    );
    const failedDelete = deleteResponses.find((response) => !response.ok());
    if (failedDelete) {
      throw new Error(`Unable to clean up exercise: ${failedDelete.status()}`);
    }
  }

  test.afterEach(async ({ request }) => {
    await deleteMatchingExercises(request);
  });

  test('create, persist, edit, cancel, and delete an exercise', async ({ page }) => {
    const initialName = `${namePrefix} resistance row`;
    const editedName = `${namePrefix} hinge press`;

    await login(page);
    await openLibrary(page);

    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    const form = page.locator('form');
    await expect(form.getByRole('heading', { name: 'New Exercise' })).toBeVisible();

    await exerciseNameInput(form).fill(initialName);
    await form.locator('select').selectOption('isolation');
    await form.getByRole('button', { name: 'Chest' }).click();
    await form.getByRole('button', { name: 'Triceps' }).click();

    const equipmentInput = form.getByPlaceholder('e.g., barbell, dumbbells');
    await equipmentInput.fill('resistance band');
    await equipmentInput.press('Enter');
    const instructionInput = form.getByPlaceholder('e.g., Lie flat on bench');
    await instructionInput.fill('Set the band at hip height');
    await form.getByRole('button', { name: 'Add' }).nth(1).click();
    await page.getByLabel('Bodyweight exercise (e.g., pull-ups, dips, push-ups)').check();

    await form.getByRole('button', { name: 'Create Exercise' }).click();
    await expect(form).not.toBeVisible();

    await page.reload();
    const initialRow = exerciseRows(page, initialName).first();
    await expect(initialRow).toBeVisible();
    await initialRow
      .getByRole('button', { name: `View details for ${initialName}` })
      .click();

    const details = exerciseDetails(page);
    await expect(details.getByRole('heading', { name: initialName })).toBeVisible();
    await expect(details.getByText('Isolation')).toBeVisible();
    await expect(details.getByText(/chest,\s*triceps/i)).toBeVisible();
    await expect(details.getByText('resistance band')).toBeVisible();
    await expect(details.getByText('Bodyweight')).toBeVisible();
    await expect(details.getByRole('listitem')).toHaveText([
      'Set the band at hip height',
    ]);
    await expect(initialRow.getByText('BW')).toBeVisible();

    await initialRow.getByTitle('Edit').click();
    await expect(form.getByRole('heading', { name: 'Edit Exercise' })).toBeVisible();
    await expect(exerciseNameInput(form)).toHaveValue(initialName);

    await exerciseNameInput(form).fill(editedName);
    await form.locator('select').selectOption('compound');
    await form.getByRole('button', { name: 'Chest' }).click();
    await form.getByRole('button', { name: 'Back' }).click();
    await form.getByRole('button', { name: 'Glutes' }).click();
    await equipmentInput.fill('loaded sandbag');
    await equipmentInput.press('Enter');
    await instructionInput.fill('Keep the spine neutral throughout');
    await form.getByRole('button', { name: 'Add' }).nth(1).click();
    await form.getByTitle('Move up').last().click();
    await page.getByLabel('Bodyweight exercise (e.g., pull-ups, dips, push-ups)').uncheck();

    await form.getByRole('button', { name: 'Save Changes' }).click();
    await expect(form).not.toBeVisible();

    await page.reload();
    const editedRow = exerciseRows(page, editedName).first();
    await expect(editedRow).toBeVisible();
    await editedRow
      .getByRole('button', { name: `View details for ${editedName}` })
      .click();
    await expect(details.getByRole('heading', { name: editedName })).toBeVisible();
    await expect(details.getByText('Compound')).toBeVisible();
    await expect(details.getByText(/triceps,\s*back,\s*glutes/i)).toBeVisible();
    await expect(details.getByText('loaded sandbag')).toBeVisible();
    await expect(details.getByText('Bodyweight')).toHaveCount(0);
    await expect(details.getByRole('listitem')).toHaveText([
      'Keep the spine neutral throughout',
      'Set the band at hip height',
    ]);

    await editedRow.getByTitle('Edit').click();
    await exerciseNameInput(form).fill(`${editedName} cancelled`);
    await form.locator('select').selectOption('cardio');
    await form.getByRole('button', { name: 'Quads' }).click();
    await equipmentInput.fill('cancelled equipment');
    await equipmentInput.press('Enter');
    await page.getByLabel('Bodyweight exercise (e.g., pull-ups, dips, push-ups)').check();
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(form).not.toBeVisible();

    await page.reload();
    const unchangedRow = exerciseRows(page, editedName).first();
    await expect(unchangedRow).toBeVisible();
    await unchangedRow
      .getByRole('button', { name: `View details for ${editedName}` })
      .click();
    await expect(details.getByRole('heading', { name: editedName })).toBeVisible();
    await expect(details.getByText('Compound')).toBeVisible();
    await expect(details.getByText('loaded sandbag')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await unchangedRow.getByTitle('Delete').click();
    await expect(exerciseRows(page, editedName)).toHaveCount(0);

    await page.reload();
    await expect(exerciseRows(page, initialName)).toHaveCount(0);
    await expect(exerciseRows(page, editedName)).toHaveCount(0);
  });
});
