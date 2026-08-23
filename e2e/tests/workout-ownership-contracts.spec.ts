import {
  expect,
  test,
  request as playwrightRequest,
  type APIRequestContext,
} from '@playwright/test';

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:18000';

type AuthContext = {
  userId: number;
  request: APIRequestContext;
};

type OwnedRecords = {
  exerciseId?: number;
  presetId?: number;
  sessionId?: number;
  setId?: number;
};

type JsonRecord = Record<string, unknown>;

const TEST_PASSWORD = 'unrelated-contract-password';

async function createUser(
  request: APIRequestContext,
  suffix: string,
  marker: string,
): Promise<AuthContext> {
  const username = `ownership_${marker}_${suffix}`;
  const password = TEST_PASSWORD;
  const email = `${username}@example.com`;

  const registerResponse = await request.post(`${API_BASE}/api/auth/register/`, {
    data: { username, email, password, password_confirm: password },
  });
  const registered = (await registerResponse.json()) as {
    user?: { username?: string };
  };
  expect(registerResponse.status(), await registerResponse.text()).toBe(201);
  expect(registered.user.username).toBe(username);

  const loginResponse = await request.post(`${API_BASE}/api/auth/login/`, {
    data: { username, password },
  });
  const loggedIn = (await loginResponse.json()) as {
    access: string;
    user?: { id?: number };
  };
  expect(loginResponse.status(), await loginResponse.text()).toBe(200);
  expect(loggedIn.user.id).toBe(registered.user.id);

  return {
    userId: registered.user.id,
    request: await playwrightRequest.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${loggedIn.access}` },
    }),
  };
}

async function postJson(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<JsonRecord> {
  const response = await request.post(`${API_BASE}${path}`, { data });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

async function getJson(
  request: APIRequestContext,
  path: string,
): Promise<JsonRecord> {
  const response = await request.get(`${API_BASE}${path}`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

async function getList(
  request: APIRequestContext,
  path: string,
): Promise<Array<Record<string, unknown>>> {
  const response = await request.get(`${API_BASE}${path}`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

test('workout records enforce ownership across direct CRUD requests', async ({ request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userA = await createUser(request, suffix, 'owner');
  const ownerMarker = `Owner A ${suffix}`;
  const intruderMarker = `User B ${suffix}`;
  const userB = await createUser(request, suffix, 'intruder');

  const records = {} as OwnedRecords;

  try {
    const exercise = await postJson(userA.request, '/api/workouts/exercises/', {
      name: ownerMarker,
      category: 'isolation',
      bodyweight: false,
      muscleGroups: ['Chest'],
      equipment: 'Dumbbell',
      instructions: ['Keep the wrist neutral.'],
    });
    const preset = await postJson(userA.request, '/api/workouts/presets/', {
      name: ownerMarker,
      notes: `Created by ${ownerMarker}`,
      dayLabel: 'Monday',
      tags: ['ownership-contract'],
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
      ],
    });
    const session = await postJson(userA.request, '/api/workouts/sessions/', {
      name: ownerMarker,
      notes: `Created by ${ownerMarker}`,
      startedAt: '2026-08-22T10:00:00.000Z',
      endedAt: null,
      sets: [
        {
          set_order: 0,
          exerciseId: exercise.id,
          setType: 'normal',
          weight: 42.5,
          reps: 8,
          dropdownWeights: null,
          loggedAt: null,
        },
      ],
    });

    records.exerciseId = Number(exercise.id);
    records.presetId = Number(preset.id);
    records.sessionId = Number(session.id);
    records.setId = Number((session.sets as Array<JsonRecord>)[0].id);

    const resources = [
      {
        kind: 'exercise',
        path: `/api/workouts/exercises/${records.exerciseId}/`,
        mutation: { name: intruderMarker },
      },
      {
        kind: 'preset',
        path: `/api/workouts/presets/${records.presetId}/`,
        mutation: { name: intruderMarker },
      },
      {
        kind: 'session',
        path: `/api/workouts/sessions/${records.sessionId}/`,
        mutation: { name: intruderMarker },
      },
      {
        kind: 'set',
        path: `/api/workouts/sets/${records.setId}/`,
        mutation: { reps: 999 },
      },
    ] as const;

    const baselines = Object.fromEntries(
      await Promise.all(resources.map(async (resource) => [
        resource.kind,
        await getJson(userA.request, resource.path),
      ])),
    );

    const accessViolations: string[] = [];
    for (const resource of resources) {
      const getResponse = await userB.request.get(`${API_BASE}${resource.path}`);
      const getBody = await getResponse.text();
      if (![401, 403, 404].includes(getResponse.status())) {
        accessViolations.push(`GET ${resource.kind}: ${getResponse.status()}`);
      }
      if (getBody.includes(ownerMarker)) {
        accessViolations.push(`GET ${resource.kind} exposed the owner marker`);
      }

      const patchResponse = await userB.request.patch(`${API_BASE}${resource.path}`, {
        data: resource.mutation,
      });
      const patchBody = await patchResponse.text();
      if (![401, 403, 404].includes(patchResponse.status())) {
        accessViolations.push(`PATCH ${resource.kind}: ${patchResponse.status()}`);
      }
      if (patchBody.includes(intruderMarker) || patchBody.includes(ownerMarker)) {
        accessViolations.push(`PATCH ${resource.kind} exposed an owner payload`);
      }

      const deleteResponse = await userB.request.delete(`${API_BASE}${resource.path}`);
      const deleteBody = await deleteResponse.text();
      if (![401, 403, 404].includes(deleteResponse.status())) {
        accessViolations.push(`DELETE ${resource.kind}: ${deleteResponse.status()}`);
      }
      if (deleteBody.includes(ownerMarker)) {
        accessViolations.push(`DELETE ${resource.kind} exposed the owner marker`);
      }
    }
    expect(accessViolations, 'cross-user access contracts').toEqual([]);

    const lists = {
      exercises: await getList(userB.request, '/api/workouts/exercises/'),
      presets: await getList(userB.request, '/api/workouts/presets/'),
      sessions: await getList(userB.request, '/api/workouts/sessions/'),
      sets: await getList(userB.request, '/api/workouts/sets/'),
    };
    const listViolations: string[] = [];
    const expectedIds: Array<[keyof typeof lists, number]> = [
      ['exercises', records.exerciseId],
      ['presets', records.presetId],
      ['sessions', records.sessionId],
      ['sets', records.setId],
    ];

    for (const [kind, id] of expectedIds) {
      if (lists[kind].some((item) => item.id === id)) {
        listViolations.push(`${kind} list contained User A object ${id}`);
      }
    }
    expect(listViolations, 'cross-user list contracts').toEqual([]);

    for (const resource of resources) {
      const current = await getJson(userA.request, resource.path);
      expect(current, `${resource.kind} retained its representation`).toEqual(
        baselines[resource.kind],
      );
    }
  } finally {
    if (records.sessionId !== undefined) {
      await userA.request.delete(`${API_BASE}/api/workouts/sessions/${records.sessionId}/`);
    }
    if (records.presetId !== undefined) {
      await userA.request.delete(`${API_BASE}/api/workouts/presets/${records.presetId}/`);
    }
    if (records.exerciseId !== undefined) {
      await userA.request.delete(`${API_BASE}/api/workouts/exercises/${records.exerciseId}/`);
    }
    await userA.request.dispose();
    await userB.request.dispose();
  }
});
