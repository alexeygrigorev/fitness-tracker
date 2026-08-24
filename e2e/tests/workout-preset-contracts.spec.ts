import {
  expect,
  test,
  request as playwrightRequest,
  type APIRequestContext,
} from '@playwright/test';

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:8000';

type JsonRecord = Record<string, unknown>;

async function createUser(
  parentRequest: APIRequestContext,
  marker: string,
): Promise<{ request: APIRequestContext }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const username = `preset_${marker}_${suffix}`;
  const password = 'Nested-Contract-Passw0rd!';

  const registerResponse = await parentRequest.post(`${API_BASE}/api/auth/register/`, {
    data: {
      username,
      email: `${username}@example.com`,
      password,
      password_confirm: password,
    },
  });
  expect(registerResponse.status(), await registerResponse.text()).toBe(201);

  const loginResponse = await parentRequest.post(`${API_BASE}/api/auth/login/`, {
    data: { username, password },
  });
  expect(loginResponse.status(), await loginResponse.text()).toBe(200);
  const { access } = await loginResponse.json();

  return {
    request: await playwrightRequest.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${access}` },
    }),
  };
}

async function postJson(
  request: APIRequestContext,
  path: string,
  data: unknown,
) {
  const response = await request.post(`${API_BASE}${path}`, { data });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

test('nested preset and plan writes enforce safe references and persistence', async ({ request }) => {
  const marker = `${Date.now()}`;
  const owner = await createUser(request, 'owner');
  const intruder = await createUser(request, 'intruder');
  let presetId: number | undefined;
  let exerciseId: number | undefined;

  try {
    const exercise = await postJson(owner.request, '/api/workouts/exercises/', {
      name: `Owner Lift ${marker}`,
      category: 'isolation',
      bodyweight: false,
      muscleGroups: ['Chest'],
      equipment: null,
      instructions: [],
    });
    exerciseId = Number(exercise.id);

    const deniedPreset = await owner.request.post(`${API_BASE}/api/workouts/presets/`, {
      data: {
        name: `Public Unsafe ${marker}`,
        is_public: true,
        exercises: [{
          exerciseId: exercise.id,
          type: 'normal',
          sets: 1,
          dropdowns: null,
          includeWarmup: false,
          order: 0,
        }],
      },
    });
    expect(deniedPreset.status()).toBe(400);
    expect(await deniedPreset.text()).not.toContain(`Owner Lift ${marker}`);

    const preset = await postJson(owner.request, '/api/workouts/presets/', {
      name: `Nested Lifecycle ${marker}`,
      notes: `Owner only ${marker}`,
      dayLabel: 'Monday',
      tags: ['e2e'],
      is_public: false,
      exercises: [
        {
          exerciseId: exercise.id,
          type: 'superset',
          sets: 2,
          dropdowns: null,
          includeWarmup: false,
          order: 0,
          supersetExercises: [
            { exerciseId: exercise.id, type: 'normal', dropdowns: null, includeWarmup: true, order: 0 },
            { exerciseId: exercise.id, type: 'dropdown', dropdowns: 2, includeWarmup: false, order: 1 },
          ],
        },
      ],
    });
    presetId = Number(preset.id);

    const replaced = await postJson(owner.request, '/api/workouts/presets/', {
      name: `Replacement Baseline ${marker}`,
      is_public: false,
      exercises: [
        {
          exerciseId: exercise.id,
          type: 'normal',
          sets: 2,
          dropdowns: null,
          includeWarmup: false,
          order: 0,
        },
        {
          exerciseId: exercise.id,
          type: 'dropdown',
          sets: 1,
          dropdowns: 3,
          includeWarmup: false,
          order: 1,
        },
      ],
    });
    const replacementId = Number(replaced.id);
    const rows = replaced.exercises as Array<JsonRecord>;
    const patchResponse = await owner.request.patch(
      `${API_BASE}/api/workouts/presets/${replacementId}/`,
      {
        data: {
          name: `Replaced Rows ${marker}`,
          exercises: [{
            id: Number(rows[1].id),
            exerciseId: exercise.id,
            type: 'normal',
            sets: 4,
            dropdowns: null,
            includeWarmup: false,
            order: 0,
          }],
        },
      },
    );
    expect(patchResponse.status(), await patchResponse.text()).toBe(200);
    const replacedBody = await patchResponse.json();
    expect(replacedBody.name).toBe(`Replaced Rows ${marker}`);
    expect((replacedBody.exercises as Array<JsonRecord>)).toHaveLength(1);
    expect(Number((replacedBody.exercises as Array<JsonRecord>)[0].id)).toBe(Number(rows[1].id));
    await owner.request.delete(`${API_BASE}/api/workouts/presets/${replacementId}/`);

    const forbiddenPatch = await intruder.request.patch(
      `${API_BASE}/api/workouts/presets/${presetId}/`,
      { data: { name: `Intruder ${marker}` } },
    );
    expect([401, 403, 404]).toContain(forbiddenPatch.status());

    const invalidSession = await intruder.request.post(
      `${API_BASE}/api/workouts/sessions/`,
      {
        data: {
          name: `Invalid Session ${marker}`,
          sets: [{ exerciseId: exercise.id, setType: 'normal' }],
        },
      },
    );
    expect(invalidSession.status()).toBe(400);
    expect(await invalidSession.text()).not.toContain(`Owner Lift ${marker}`);

    const ownPlanSeed = await postJson(intruder.request, '/api/workouts/presets/', {
      name: `Intruder Seed ${marker}`,
      is_public: false,
      exercises: [],
    });
    const invalidPlan = await intruder.request.post(`${API_BASE}/api/workouts/plans/`, {
      data: {
        name: `Atomic Plan ${marker}`,
        preset_ids: [ownPlanSeed.id, preset.id],
      },
    });
    expect(invalidPlan.status()).toBe(400);
    const plans = await intruder.request.get(`${API_BASE}/api/workouts/plans/`);
    expect(plans.status()).toBe(200);
    const planList = await plans.json();
    expect(planList.some((plan: JsonRecord) => plan.name === `Atomic Plan ${marker}`)).toBe(false);
    await intruder.request.delete(`${API_BASE}/api/workouts/presets/${ownPlanSeed.id}/`);
  } finally {
    if (presetId !== undefined) {
      await owner.request.delete(`${API_BASE}/api/workouts/presets/${presetId}/`);
    }
    if (exerciseId !== undefined) {
      await owner.request.delete(`${API_BASE}/api/workouts/exercises/${exerciseId}/`);
    }
    await owner.request.dispose();
    await intruder.request.dispose();
  }
});
