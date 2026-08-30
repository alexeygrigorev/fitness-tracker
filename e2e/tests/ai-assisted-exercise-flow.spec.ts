import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:8000';
const PASSWORD = 'ai-assisted-exercise-pass';

type TestUser = {
  id: number;
  username: string;
  email: string;
};

type Session = {
  access: string;
  user: TestUser;
};

type ExerciseAnalysis = {
  name: string;
  category: 'compound' | 'isolation' | 'cardio';
  muscleGroups: string[];
  equipment: string | null;
  instructions: string[];
  bodyweight: boolean;
};

type ExerciseRecord = ExerciseAnalysis & {
  id: number;
};

function uniqueSuffix(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const randomLetters = Array.from(
    { length: 10 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');

  return `${Date.now()}-${randomLetters}`;
}

async function createSession(
  request: APIRequestContext,
): Promise<Session> {
  const username = `ai-exercise-owner-${uniqueSuffix()}`;
  const registration = await request.post(`${API_BASE}/api/auth/register/`, {
    data: {
      username,
      email: `${username}@example.com`,
      password: PASSWORD,
      password_confirm: PASSWORD,
    },
  });
  expect(registration.status(), await registration.text()).toBe(201);

  const login = await request.post(`${API_BASE}/api/auth/login/`, {
    form: { username, password: PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(200);

  return (await login.json()) as Session;
}

async function authenticatePage(page: Page, session: Session): Promise<void> {
  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('user', JSON.stringify(user));
  }, { token: session.access, user: session.user });
}

test('AI exercise review creates an editable persistent exercise', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);

  const session = await createSession(request);
  const headers = { Authorization: `Bearer ${session.access}` };
  const marker = uniqueSuffix();
  const description = `dumbbell chest press ${marker}`;
  let exerciseId: number | undefined;

  try {
    await authenticatePage(page, session);
    await page.goto('/workouts/library');

    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();
    await page.getByRole('button', { name: 'Add exercise with AI' }).click();

    const aiDialog = page.getByRole('dialog', { name: 'Add Exercise with AI' });
    await expect(aiDialog).toBeVisible();
    await aiDialog
      .getByPlaceholder(/Barbell Bench Press/)
      .fill(description);

    const analysisRequestPromise = page.waitForRequest((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.pathname === '/api/ai/analyze-exercise/' &&
        candidate.method() === 'POST'
      );
    });
    const analysisResponsePromise = page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.pathname === '/api/ai/analyze-exercise/' &&
        candidate.request().method() === 'POST'
      );
    });

    await aiDialog
      .getByRole('button', { name: 'Analyze Exercise with AI' })
      .click();

    const [analysisRequest, analysisResponse] = await Promise.all([
      analysisRequestPromise,
      analysisResponsePromise,
    ]);
    expect(analysisRequest.postDataJSON()).toEqual({ description });
    expect(analysisResponse.status(), await analysisResponse.text()).toBe(200);

    const analysis = (await analysisResponse.json()) as ExerciseAnalysis;
    expect(analysis).toEqual({
      name: description.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      category: 'compound',
      muscleGroups: ['chest', 'triceps', 'shoulders'],
      equipment: 'dumbbells',
      instructions: [
        'Lie on a bench holding dumbbells at chest height.',
        'Press the dumbbells upward until your arms are extended.',
        'Lower them under control to the starting position.',
      ],
      bodyweight: false,
    });

    await expect(
      aiDialog.getByRole('heading', {
        level: 3,
        name: analysis.name,
      }),
    ).toBeVisible();
    await expect(aiDialog.getByText('Compound')).toBeVisible();
    await expect(aiDialog.getByText('chest, triceps, shoulders')).toBeVisible();
    await expect(aiDialog.getByText('dumbbells', { exact: true })).toBeVisible();
    await expect(aiDialog.locator('ol').getByRole('listitem')).toHaveText([
      analysis.instructions[0],
      analysis.instructions[1],
      analysis.instructions[2],
    ]);

    const creationResponsePromise = page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.pathname === '/api/workouts/exercises/' &&
        candidate.request().method() === 'POST'
      );
    });
    await aiDialog.getByRole('button', { name: 'Add Exercise' }).click();

    const creationResponse = await creationResponsePromise;
    const createdExercise = (await creationResponse.json()) as ExerciseRecord;
    exerciseId = createdExercise.id;
    expect(
      creationResponse.status(),
      await creationResponse.text(),
    ).toBe(201);

    const editDialog = page.getByRole('dialog', { name: 'Edit Exercise' });
    await expect(editDialog).toBeVisible();
    const nameInput = editDialog.getByPlaceholder(
      'e.g., Barbell Bench Press',
      { exact: true },
    );
    const categorySelect = editDialog.locator('select');

    await expect(nameInput).toHaveValue(
      analysis.name,
    );
    await expect(categorySelect).toHaveValue(
      analysis.category,
    );

    const editedName = `Edited Dumbbell Press ${marker}`;
    await nameInput.fill(editedName);
    await categorySelect.selectOption('isolation');
    await editDialog.getByRole('button', { name: 'Chest', exact: true }).click();
    await editDialog.getByRole('button', { name: 'Back', exact: true }).click();

    const equipmentInput = editDialog.getByPlaceholder('e.g., barbell, dumbbells');
    await equipmentInput.fill('loaded sandbag');
    await equipmentInput.press('Enter');

    const instructionInput = editDialog.getByPlaceholder('e.g., Lie flat on bench');
    await instructionInput.fill('Keep the spine neutral throughout');
    await editDialog.getByRole('button', { name: 'Add' }).nth(1).click();
    await editDialog
      .getByLabel('Bodyweight exercise (e.g., pull-ups, dips, push-ups)')
      .check();

    const saveResponsePromise = page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.pathname === `/api/workouts/exercises/${exerciseId}/` &&
        candidate.request().method() === 'PUT'
      );
    });
    await editDialog.getByRole('button', { name: 'Save Changes' }).click();

    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status(), await saveResponse.text()).toBe(200);
    const savedExercise = (await saveResponse.json()) as ExerciseRecord;
    await expect(editDialog).toHaveCount(0);

    await page.reload();
    const editedRow = page
      .locator('div.p-3.rounded-lg.border')
      .filter({ has: page.getByText(editedName, { exact: true }) })
      .first();
    await expect(editedRow).toBeVisible();
    await expect(editedRow.getByText('BW', { exact: true })).toBeVisible();
    await editedRow
      .getByRole('button', { name: `View details for ${editedName}` })
      .click();

    const details = page.locator('div.hidden.md\\:grid > div').nth(1);
    await expect(details.getByRole('heading', { name: editedName })).toBeVisible();
    await expect(details.getByText('Isolation')).toBeVisible();
    await expect(details.getByText(/triceps,\s*shoulders,\s*back/i)).toBeVisible();
    await expect(details.getByText('loaded sandbag')).toBeVisible();
    await expect(details.getByRole('listitem')).toHaveText([
      analysis.instructions[0],
      analysis.instructions[1],
      analysis.instructions[2],
      'Keep the spine neutral throughout',
    ]);

    const persistedResponse = await request.get(
      `${API_BASE}/api/workouts/exercises/${exerciseId}/`,
      { headers },
    );
    expect(
      persistedResponse.status(),
      await persistedResponse.text(),
    ).toBe(200);
    expect(await persistedResponse.json()).toEqual(savedExercise);
  } finally {
    if (exerciseId !== undefined) {
      const cleanupResponse = await request.delete(
        `${API_BASE}/api/workouts/exercises/${exerciseId}/`,
        { headers },
      );
      if (!cleanupResponse.ok()) {
        console.warn(
          `Unable to clean up exercise ${exerciseId}: ${cleanupResponse.status()}`,
        );
      }
    }
  }
});
