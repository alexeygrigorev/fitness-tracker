import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../src/lambda.js';
import type { ApiResponse } from '../src/types.js';

const require = createRequire(import.meta.url);
const DynamoDbLocal = require('dynamodb-local') as typeof import('dynamodb-local');

interface CallResult {
  status: number;
  headers: Record<string, string>;
  body: any;
}

let client: DynamoDBClient;
let documentClient: DynamoDBDocumentClient;
let port: number;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const selectedPort = typeof address === 'object' && address ? address.port : 0;
      server.close(() => (selectedPort ? resolve(selectedPort) : reject(new Error('No free port'))));
    });
  });
}

function waitForPort(selectedPort: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const connect = (): void => {
      const socket = net.connect(selectedPort, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        attempts += 1;
        if (attempts >= 100) {
          reject(new Error('DynamoDB Local did not open its port'));
          return;
        }
        setTimeout(connect, 50);
      });
    };
    connect();
  });
}

async function waitForTableActive(
  selectedClient: DynamoDBClient,
  tableName: string,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const result = await selectedClient.send(new DescribeTableCommand({ TableName: tableName }));
      if (result.Table?.TableStatus === 'ACTIVE') {
        return;
      }
    } catch (error) {
      if ((error as { name?: string }).name !== 'ResourceNotFoundException') {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${tableName} did not become active`);
}

async function call(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<CallResult> {
  const response: ApiResponse = await handler({
    httpMethod: method,
    path,
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  return {
    status: response.statusCode,
    headers: response.headers,
    body: response.body ? JSON.parse(response.body) : null,
  };
}

describe('TypeScript Lambda API foundation', () => {
  let accessToken: string;
  let secondAccessToken: string;

  before(async () => {
    process.env.TABLE_NAME = 'fitness-test';
    process.env.JWT_SECRET = 'integration-secret-with-at-least-fifty-characters-long';
    process.env.AWS_REGION = 'us-east-1';
    process.env.NODE_ENV = 'test';

    port = await freePort();
    await DynamoDbLocal.launch(port, null, ['-sharedDb']);
    await waitForPort(port);
    process.env.DYNAMODB_ENDPOINT = `http://127.0.0.1:${port}`;
    client = new DynamoDBClient({
      region: 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
    documentClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
    await client.send(new CreateTableCommand({
      TableName: 'fitness-test',
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'username', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'UsernameIndex',
          KeySchema: [{ AttributeName: 'username', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'KEYS_ONLY' },
        },
        {
          IndexName: 'EmailIndex',
          KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'KEYS_ONLY' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    }));
    await waitForTableActive(client, 'fitness-test');
    await Promise.all([101, 102].map((exerciseId) => documentClient.send(new PutCommand({
      TableName: 'fitness-test',
      Item: { pk: `EXERCISE#${exerciseId}`, sk: 'METADATA', id: exerciseId, user_id: null },
    }))));
  });

  after(async () => {
    documentClient?.destroy();
    client?.destroy();
    DynamoDbLocal.stop(port);
    delete process.env.DYNAMODB_ENDPOINT;
  });

  it('reports a healthy DynamoDB-backed API', async () => {
    const result = await call('GET', '/api/health/');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      status: 'healthy',
      version: '1.0.0',
      framework: 'Django REST Framework',
    });
  });

  it('registers, logs in, reads, and updates the profile', async () => {
    const registered = await call('POST', '/api/auth/register/', { body: {
      username: 'foundation-user',
      email: 'foundation@example.com',
      password: 'strong-password-123',
      password_confirm: 'strong-password-123',
    }});
    assert.equal(registered.status, 201);
    assert.equal(registered.body.user.id, 1);
    assert.equal(registered.body.message, 'User created successfully');

    const loggedIn = await call('POST', '/api/auth/login/', { body: {
      username: 'foundation-user',
      password: 'strong-password-123',
    }});
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.body.user.email, 'foundation@example.com');
    assert.match(loggedIn.body.access, /^[^.]+\.[^.]+\.[^.]+$/);
    accessToken = loggedIn.body.access;

    const profile = await call('GET', '/api/auth/me/', { token: accessToken });
    assert.equal(profile.status, 200);
    assert.deepEqual(profile.body, {
      id: 1,
      username: 'foundation-user',
      email: 'foundation@example.com',
      dark_mode: false,
    });

    const updated = await call('PATCH', '/api/auth/me/update/', {
      body: { dark_mode: true },
      token: accessToken,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.dark_mode, true);
  });

  it('rejects anonymous profile access and bad credentials', async () => {
    const anonymous = await call('GET', '/api/auth/me/');
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.detail, 'Authentication credentials were not provided.');

    const failed = await call('POST', '/api/auth/login/', { body: {
      username: 'foundation-user',
      password: 'wrong-password',
    }});
    assert.equal(failed.status, 400);
    assert.equal(failed.body.code, 'no_active_account');
  });

  it('stores user-specific canonical exercise settings', async () => {
    const created = await call('POST', '/api/auth/exercise-settings/101/', {
      body: { weight: 80, reps: 10 },
      token: accessToken,
    });
    assert.equal(created.status, 200);
    assert.deepEqual(created.body, { weight: 80, reps: 10 });

    const updated = await call('PATCH', '/api/auth/exercise-settings/101/', {
      body: { weight: 82.5, reps: 8, subSets: [{ weight: 70, reps: 6 }] },
      token: accessToken,
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(updated.body, {
      weight: 82.5,
      reps: 8,
      subSets: [{ weight: 70, reps: 6 }],
    });

    const listed = await call('GET', '/api/auth/exercise-settings/', { token: accessToken });
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body, { 101: updated.body });

    const registered = await call('POST', '/api/auth/register/', { body: {
      username: 'isolation-user',
      email: 'isolation@example.com',
      password: 'another-password-123',
      password_confirm: 'another-password-123',
    }});
    assert.equal(registered.status, 201);
    const loggedIn = await call('POST', '/api/auth/login/', { body: {
      username: 'isolation-user',
      password: 'another-password-123',
    }});
    secondAccessToken = loggedIn.body.access;
    const isolated = await call('GET', '/api/auth/exercise-settings/', {
      token: secondAccessToken,
    });
    assert.deepEqual(isolated.body, {});
  });

  it('applies the default rep count and preserves an omitted weight on update', async () => {
    const first = await call('POST', '/api/auth/exercise-settings/102/', {
      body: {},
      token: accessToken,
    });
    assert.deepEqual(first.body, { reps: 10 });

    const second = await call('PATCH', '/api/auth/exercise-settings/102/', {
      body: { reps: 5 },
      token: accessToken,
    });
    assert.deepEqual(second.body, { reps: 5 });
  });

  it('returns DRF-compatible validation, ownership, routing, and CORS responses', async () => {
    const invalid = await call('POST', '/api/auth/register/', { body: {
      username: 'validator',
      email: 'not-an-email',
      password: 'short',
      password_confirm: 'different',
    }});
    assert.equal(invalid.status, 400);
    assert.ok(Array.isArray(invalid.body.email));
    assert.ok(Array.isArray(invalid.body.password));

    const missingExercise = await call('POST', '/api/auth/exercise-settings/999999/', {
      body: { reps: 8 },
      token: accessToken,
    });
    assert.equal(missingExercise.status, 404);

    const missingRoute = await call('GET', '/api/does-not-exist/');
    assert.equal(missingRoute.status, 404);

    const response = await handler({
      httpMethod: 'OPTIONS',
      path: '/api/auth/login/',
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  });
});
