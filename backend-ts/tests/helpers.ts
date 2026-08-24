import { createRequire } from 'node:module';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { ExerciseItem } from '../src/types.js';
import { handler } from '../src/lambda.js';
import type { ApiResponse } from '../src/types.js';

const require = createRequire(import.meta.url);
const DynamoDbLocal = require('dynamodb-local') as typeof import('dynamodb-local');

export interface ApiCallResult {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export interface TestApi {
  readonly client: DynamoDBClient;
  readonly documentClient: DynamoDBDocumentClient;
  readonly endpoint: string;
  readonly port: number;
  readonly tableName: string;
  call(
    method: string,
    path: string,
    options?: { body?: unknown; token?: string },
  ): Promise<ApiCallResult>;
  stop(): void;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const selectedPort =
        typeof address === 'object' && address ? address.port : 0;
      server.close(() =>
        selectedPort ? resolve(selectedPort) : reject(new Error('No free port')),
      );
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
      const result = await selectedClient.send(
        new DescribeTableCommand({ TableName: tableName }),
      );
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

export type ExerciseSeed = Partial<Omit<ExerciseItem, 'pk' | 'sk'>> & {
  id: number;
};

export async function seedExercises(
  selectedDocumentClient: DynamoDBDocumentClient,
  tableName: string,
  exercises: Array<number | ExerciseSeed>,
): Promise<void> {
  await Promise.all(exercises.map((exercise) => {
    const seed: ExerciseSeed = typeof exercise === 'number'
      ? { id: exercise }
      : exercise;
    const id = seed.id;
    const category = seed.category ??
      (seed.is_compound ? 'compound' : 'isolation');
    const now = new Date().toISOString();
    const item: ExerciseItem = {
      pk: `EXERCISE#${id}`,
      sk: 'METADATA',
      id,
      user_id: seed.user_id ?? null,
      name: seed.name ?? `Exercise ${id}`,
      muscle_groups: structuredClone(seed.muscle_groups ?? []),
      equipment_name: seed.equipment_name ?? null,
      category,
      instructions: structuredClone(seed.instructions ?? []),
      is_compound: category === 'compound',
      is_bodyweight: seed.is_bodyweight ?? false,
      created_at: now,
      updated_at: now,
    };

    return selectedDocumentClient.send(new PutCommand({
      TableName: tableName,
      Item: item,
    }));
  }));
}

export async function registerAndLogin(
  api: TestApi,
  username: string,
  email?: string,
): Promise<{ accessToken: string; refreshToken: string; userId: number }> {
  const selectedEmail = email ?? `${username}@example.com`;
  const registered = await api.call('POST', '/api/auth/register/', {
    body: {
      username,
      email: selectedEmail,
      password: 'strong-password-123',
      password_confirm: 'strong-password-123',
    },
  });
  if (registered.status !== 201) {
    throw new Error(`Test registration failed: ${JSON.stringify(registered.body)}`);
  }

  const loggedIn = await api.call('POST', '/api/auth/login/', {
    body: { username, password: 'strong-password-123' },
  });
  if (loggedIn.status !== 200) {
    throw new Error(`Test login failed: ${JSON.stringify(loggedIn.body)}`);
  }

  return {
    accessToken: loggedIn.body.access,
    refreshToken: loggedIn.body.refresh,
    userId: registered.body.user.id,
  };
}

export async function startTestApi(
  options: { exerciseIds?: number[] } = {},
): Promise<TestApi> {
  const environmentKeys = [
    'TABLE_NAME',
    'JWT_SECRET',
    'AWS_REGION',
    'NODE_ENV',
    'DYNAMODB_ENDPOINT',
  ] as const;
  const previousEnvironment = new Map(environmentKeys.map((key) => [
    key,
    process.env[key],
  ]));
  const tableName = `fitness-test-${randomUUID()}`;
  const selectedPort = await freePort();

  process.env.TABLE_NAME = tableName;
  process.env.JWT_SECRET =
    'integration-secret-with-at-least-fifty-characters-long';
  process.env.AWS_REGION = 'us-east-1';
  process.env.NODE_ENV = 'test';

  await DynamoDbLocal.launch(selectedPort, null, ['-inMemory']);
  await waitForPort(selectedPort);

  const endpoint = `http://127.0.0.1:${selectedPort}`;
  process.env.DYNAMODB_ENDPOINT = endpoint;
  const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  const documentClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  await client.send(new CreateTableCommand({
    TableName: tableName,
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
  await waitForTableActive(client, tableName);
  await seedExercises(
    documentClient,
    tableName,
    options.exerciseIds ?? [101, 102],
  );

  return {
    client,
    documentClient,
    endpoint,
    port: selectedPort,
    tableName,
    async call(method, path, callOptions = {}) {
      const response: ApiResponse = await handler({
        httpMethod: method,
        path,
        headers: {
          ...(callOptions.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...(callOptions.token
            ? { Authorization: `Bearer ${callOptions.token}` }
            : {}),
        },
        ...(callOptions.body === undefined
          ? {}
          : { body: JSON.stringify(callOptions.body) }),
      });
      return {
        status: response.statusCode,
        headers: response.headers,
        body: response.body ? JSON.parse(response.body) : null,
      };
    },
    stop() {
      documentClient.destroy();
      client.destroy();
      DynamoDbLocal.stop(selectedPort);
      for (const [key, value] of previousEnvironment) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}
