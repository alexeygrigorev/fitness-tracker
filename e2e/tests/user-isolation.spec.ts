import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:18000';
const PASSWORD = 'workout-isolation-pass';

type TestUser = {
  id: number;
  username: string;
  email: string;
};

type LoginResponse = {
  access: string;
  user: TestUser;
};

type Session = {
  token: string;
  user: TestUser;
};

type SeededRecords = {
  exerciseId?: number;
  presetId?: number;
  sessionId?: number;
};

type Headers = Record<string, string>;

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function expectCreated(
  response: Awaited<ReturnType<APIRequestContext['post']>>,
): Promise<Record<string, unknown>> {
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

async function createSession(
  request: APIRequestContext,
  prefix: string,
): Promise<Session> {
  const username = `${prefix}-${uniqueSuffix()}`;
  const registerResponse = await request.post(apiUrl('/api/auth/register/'), {
    data: {
      username,
      email: `${username}@example.com`,
      password: PASSWORD,
      password_confirm: PASSWORD,
    },
  });
  expect(registerResponse.status(), await registerResponse.text()).toBe(201);

  const loginResponse = await request.post(apiUrl('/api/auth/login/'), {
    form: { username, password: PASSWORD },
  });
  expect(loginResponse.status(), await loginResponse.text()).toBe(200);
  const loggedIn = (await loginResponse.json()) as LoginResponse;

  return {
    token: loggedIn.access,
    user: loggedIn.user,
  };
}

async function authenticatePage(page: Page, session: Session): Promise<void> {
  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('user', JSON.stringify(user));
  }, session);
}

async function seedCompletedWorkout(
  request: APIRequestContext,
  session: Session,
  marker: string,
): Promise<SeededRecords> {
  const headers = { Authorization: `Bearer ${session.token}` };
  const exercise = await expectCreated(
    await request.post(apiUrl('/api/workouts/exercises/'), {
      headers,
      data: {
        name: `Private Lift ${marker}`,
        category: 'isolation',
        bodyweight: false,
        muscleGroups: ['Chest'],
        equipment: null,
        instructions: [],
      },
    }),
  );

  const preset = await expectCreated(
    await request.post(apiUrl('/api/workouts/presets/'), {
      headers,
      data: {
        name: `Owner Preset ${marker}`,
        notes: `Visible only to ${session.user.username}`,
        dayLabel: null,
        tags: ['user-isolation'],
        is_public: false,
        exercises: [{
          exerciseId: exercise.id,
          type: 'normal',
          sets: 1,
          dropdowns: null,
          includeWarmup: false,
          order: 0,
        }],
      },
    }),
  );

  const startedAt = new Date(Date.now() - 60_000).toISOString();
  const workout = await expectCreated(
    await request.post(apiUrl('/api/workouts/sessions/'), {
      headers,
      data: {
        name: `Finished Workout ${marker}`,
        notes: `Owner-only ${marker}`,
        preset_id: preset.id,
        startedAt,
        endedAt: new Date().toISOString(),
        sets: [{
          set_order: 0,
          exerciseId: exercise.id,
          setType: 'normal',
          weight: 42.5,
          reps: 8,
          dropdownWeights: null,
          loggedAt: startedAt,
        }],
      },
    }),
  );

  return {
    exerciseId: Number(exercise.id),
    presetId: Number(preset.id),
    sessionId: Number(workout.id),
  };
}

async function cleanupRecords(
  request: APIRequestContext,
  session: Session,
  records: SeededRecords,
): Promise<void> {
  const headers = { Authorization: `Bearer ${session.token}` };
  if (records.sessionId !== undefined) {
    await request.delete(apiUrl(`/api/workouts/sessions/${records.sessionId}/`), { headers });
  }
  if (records.presetId !== undefined) {
    await request.delete(apiUrl(`/api/workouts/presets/${records.presetId}/`), { headers });
  }
  if (records.exerciseId !== undefined) {
    await request.delete(apiUrl(`/api/workouts/exercises/${records.exerciseId}/`), { headers });
  }
}

test('completed workouts are isolated between browser sessions', async ({
  browser,
  request,
}) => {
  const marker = uniqueSuffix();
  const owner = await createSession(request, 'isolation-owner');
  const intruder = await createSession(request, 'isolation-intruder');
  const records = await seedCompletedWorkout(request, owner, marker);

  let ownerContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let intruderContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

  try {
    ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await authenticatePage(ownerPage, owner);
    await ownerPage.goto('/workouts');

    const ownerWorkout = ownerPage.locator(`[data-workout-id="${records.sessionId}"]`);
    await expect(ownerWorkout).toContainText(`Finished Workout ${marker}`);

    intruderContext = await browser.newContext();
    const intruderPage = await intruderContext.newPage();
    await authenticatePage(intruderPage, intruder);
    await intruderPage.goto('/workouts');

    await expect(intruderPage.getByText(marker)).toHaveCount(0);
    await expect(
      intruderPage.locator(`[data-workout-id="${records.sessionId}"]`),
    ).toHaveCount(0);
  } finally {
    await ownerContext?.close();
    await intruderContext?.close();
    await cleanupRecords(request, owner, records);
  }
});
