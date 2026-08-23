import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadConfig } from '../src/config.js';
import { corsHeaders, jsonResponse } from '../src/http.js';
import { handler } from '../src/lambda.js';
import type { NormalizedRequest } from '../src/types.js';

const savedEnvironment: Record<string, string | undefined> = {};
let frontendRoot: string | undefined;

function controlEnvironment(): NodeJS.ProcessEnv {
  return {
    TABLE_NAME: 'runtime-test-table',
    JWT_SECRET: 'production-secret-value-with-more-than-fifty-characters',
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: '',
  };
}

async function callHandler(path: string): Promise<{
  status: number;
  headers: Record<string, string>;
  body: any;
}> {
  const response = await handler({
    httpMethod: 'GET',
    path,
    headers: {},
  });
  return {
    status: response.statusCode,
    headers: response.headers,
    body: response.headers['content-type']?.startsWith('application/json')
      ? response.body
        ? JSON.parse(response.body)
        : null
      : response.body,
  };
}

describe('ProductionSettingsTests', () => {
  afterEach(async () => {
    for (const [name, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    if (frontendRoot) {
      await rm(frontendRoot, { recursive: true, force: true });
      frontendRoot = undefined;
    }
  });

  it('test_debug_keeps_local_browser_origins', () => {
    const config = loadConfig({ ...controlEnvironment(), NODE_ENV: 'development' });
    for (const origin of [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ]) {
      assert.ok(config.allowedOrigins.has(origin));
    }

    const request = { origin: 'http://localhost:5173' } as NormalizedRequest;
    const headers = corsHeaders(request, config.allowedOrigins);
    assert.equal(headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal('access-control-allow-credentials' in headers, false);
  });

  it('test_fly_proxy_enables_transport_hardening', async () => {
    const config = loadConfig(controlEnvironment());
    const template = await readFile(`${process.cwd()}/template.yaml`, 'utf8');
    assert.match(template, /FunctionUrlConfig:/);
    assert.match(template, /AuthType:\s*NONE/);
    assert.match(template, /InvokeMode:\s*BUFFERED/);

    const request = { origin: 'https://rough-leaf-5415.fly.dev' } as NormalizedRequest;
    const response = jsonResponse(200, {}, corsHeaders(
      request,
      config.allowedOrigins,
    ));
    assert.equal(
      response.headers['strict-transport-security'],
      'max-age=31536000; includeSubDomains',
    );
    assert.equal(response.headers['referrer-policy'], 'same-origin');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert.equal(response.headers['cross-origin-opener-policy'], 'same-origin');
  });

  it('test_portable_direct_http_mode_does_not_redirect_health_checks', async () => {
    for (const [name, value] of Object.entries(controlEnvironment())) {
      savedEnvironment[name] = process.env[name];
      process.env[name] = value;
    }
    savedEnvironment.DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT;
    process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:1';

    const response = await callHandler('/api/health/');
    assert.equal(response.status, 503);
    assert.equal('location' in response.headers, false);
  });

  it('test_short_production_secret_is_rejected', () => {
    assert.throws(
      () => loadConfig({
        ...controlEnvironment(),
        JWT_SECRET: 'short-secret',
      }),
      /JWT_SECRET must contain at least 50 characters/,
    );
  });
});

describe('HealthEndpointTests', () => {
  it('test_database_failure_is_unready', async () => {
    const controlled = controlEnvironment();
    for (const [name, value] of Object.entries(controlled)) {
      savedEnvironment[name] = process.env[name];
      process.env[name] = value;
    }
    savedEnvironment.DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT;
    process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:1';

    const response = await callHandler('/api/health/');
    assert.equal(response.status, 503);
    assert.equal(response.body.status, 'unhealthy');
  });
});

describe('SpaCacheTests', () => {
  it('test_hashed_assets_are_immutable_and_entrypoint_is_not_stored', async () => {
    frontendRoot = await mkdtemp(path.join(tmpdir(), 'fitness-spa-'));
    await mkdir(path.join(frontendRoot, 'assets'));
    await writeFile(
      path.join(frontendRoot, 'assets', 'app.test.js'),
      'window.test = true;\n',
    );
    await writeFile(
      path.join(frontendRoot, 'index.html'),
      '<!doctype html><title>Fitness</title>',
    );

    const controlled = {
      ...controlEnvironment(),
      FRONTEND_BUILD: frontendRoot,
    };
    for (const [name, value] of Object.entries(controlled)) {
      savedEnvironment[name] = process.env[name];
      process.env[name] = value;
    }

    const asset = await callHandler('/assets/app.test.js');
    const entrypoint = await callHandler('/');
    assert.equal(asset.status, 200);
    assert.equal(
      asset.headers['cache-control'],
      'public, max-age=31536000, immutable',
    );
    assert.equal(asset.headers['content-type'], 'text/javascript');
    assert.equal(asset.body, 'window.test = true;\n');

    assert.equal(entrypoint.status, 200);
    assert.equal(entrypoint.headers['cache-control'], 'no-store, must-revalidate');
    assert.ok(entrypoint.headers['content-type'].startsWith('text/html'));
    assert.match(entrypoint.body, /<title>Fitness<\/title>/);
  });
});
