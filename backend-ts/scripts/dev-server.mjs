#!/usr/bin/env node
// Local HTTP dev server for backend-ts.
//
// Wraps the Lambda `handler` export behind a real Node HTTP server so the
// TypeScript backend can be exercised by tools that need a live network
// endpoint (Playwright E2E, manual curl/browser testing) instead of the
// in-process `handler()` invocation used by the Node test runner.
//
// Data is served from DynamoDB Local. By default an empty table is created;
// pass a migration snapshot (see `npm run rehearsal:migration`) to load a
// realistic dataset exported from the Django backend, matching production
// parity fixtures (including real pbkdf2_sha256 password hashes that verify
// unchanged against backend-ts's own crypto module).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiledPath = (relativePath) =>
  pathToFileURL(join(backendRoot, '.tmp/ts-build', relativePath)).href;

const port = Number.parseInt(process.env.PORT ?? '8000', 10);
const snapshotArgument = process.argv[2] ??
  process.env.MIGRATION_SNAPSHOT ??
  join(backendRoot, '.tmp/migration-snapshot.json');

const { startTestApi } = await import(compiledPath('tests/helpers.js'));
const { handler } = await import(compiledPath('src/lambda.js'));

let snapshotSummary = null;
async function loadSnapshotIfPresent(api) {
  let rawSnapshot;
  try {
    rawSnapshot = await readFile(snapshotArgument, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.log(
        `No migration snapshot found at ${snapshotArgument}; starting with an empty table.`,
      );
      return;
    }
    throw error;
  }

  const { buildMigrationItems } = await import(
    compiledPath('src/migration/snapshot.js')
  );
  const { loadMigrationItems } = await import(
    compiledPath('src/migration/load.js')
  );

  const parsedSnapshot = JSON.parse(rawSnapshot);
  const builtItems = buildMigrationItems(parsedSnapshot);
  const result = await loadMigrationItems(
    { documentClient: api.documentClient, tableName: api.tableName },
    builtItems.allItems,
  );
  snapshotSummary = {
    snapshotPath: snapshotArgument,
    sourceRowCount: builtItems.sourceRowCount,
    ...result,
  };
  console.log(
    `Loaded migration snapshot: ${JSON.stringify(snapshotSummary)}`,
  );
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    request.on('error', rejectBody);
  });
}

function toLambdaEvent(request, url, rawBody) {
  const headers = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers[key] = value.join(', ');
    } else if (value !== undefined) {
      headers[key] = value;
    }
  }
  const queryStringParameters = Object.fromEntries(url.searchParams.entries());
  return {
    httpMethod: request.method ?? 'GET',
    path: url.pathname,
    rawPath: url.pathname,
    headers,
    queryStringParameters,
    body: rawBody.length > 0 ? rawBody : undefined,
    isBase64Encoded: false,
  };
}

async function main() {
  console.log('Starting DynamoDB Local and provisioning table...');
  const api = await startTestApi({ exerciseIds: [] });
  await loadSnapshotIfPresent(api);

  const server = createServer((request, response) => {
    (async () => {
      const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
      const rawBody = await readRequestBody(request);
      const event = toLambdaEvent(request, url, rawBody);
      const result = await handler(event);
      response.writeHead(result.statusCode, result.headers ?? {});
      if (result.isBase64Encoded && result.body) {
        response.end(Buffer.from(result.body, 'base64'));
      } else {
        response.end(result.body ?? '');
      }
    })().catch((error) => {
      console.error('Unhandled dev-server error', error);
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json' });
      }
      response.end(JSON.stringify({ detail: 'Internal Server Error' }));
    });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`backend-ts dev server listening on http://127.0.0.1:${port}`);
    if (snapshotSummary) {
      console.log(`Serving migrated data: ${snapshotSummary.itemCount} items.`);
    }
  });

  const shutdown = () => {
    console.log('Shutting down backend-ts dev server...');
    server.close(() => {
      api.stop();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start backend-ts dev server', error);
  process.exit(1);
});
