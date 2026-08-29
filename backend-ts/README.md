# TypeScript backend

This directory contains the complete API runtime: a Node.js 24 TypeScript
Lambda handler, DynamoDB repository, migration tools, and integration tests.
The same handler runs in-process, behind the local HTTP server, and in the SAM
artifact used for deployment.

## Local checks

```sh
npm ci
npm run typecheck
npm run test:integration
npm run build
npm run verify:artifact
```

Integration tests start an in-memory DynamoDB Local instance and invoke the
real handler. Java is required by the DynamoDB Local package.

The complete browser suite has two local modes. Both use the committed
deterministic fixture at `../e2e/fixtures/backend-seed.json`:

```sh
../e2e/run-local-ts.sh   # TypeScript dev server + Vite
../e2e/run-sam-ts.sh     # SAM-built Lambda/SPA + local HTTP server
```

## Runtime configuration

Required production variables are `TABLE_NAME` and `JWT_SECRET` (at least 50
characters). Optional variables are:

- `DYNAMODB_ENDPOINT` — local DynamoDB endpoint; the local runners set this
  automatically.
- `ALLOWED_ORIGINS` — comma-separated exact browser origins. Leave empty for a
  same-origin packaged SPA.
- `FRONTEND_BUILD` — directory containing the packaged SPA (`frontend` in the
  SAM artifact).
- `TIME_ZONE` — IANA timezone used when deriving meal dates (defaults to UTC).
- `NODE_ENV` — use `production` for a packaged deployment.

Run the HTTP adapter manually with `npm run dev`; it provisions an ephemeral
DynamoDB Local table and optionally loads a migration snapshot from
`MIGRATION_SNAPSHOT`.

## SQLite migration

`export:sqlite` is a dependency-free, read-only exporter for the existing
SQLite schema. It emits the versioned snapshot consumed by the migration
rehearsal and does not need an application server:

```sh
npm run export:sqlite -- /absolute/path/to/source.sqlite .tmp/migration-snapshot.json
npm run rehearsal:migration -- .tmp/migration-snapshot.json
```

The loader refuses non-empty targets, preserves numeric IDs, seeds every
counter, retries throttled writes, and deep-compares all imported records.

## AWS SAM artifact

The template is `template.yaml` and targets a Node.js 24 ARM64 Lambda Function
URL with a pay-per-request DynamoDB table. Build the exact package locally:

```sh
npm run build:cutover
sam build --template template.yaml
```

`npm run verify:artifact` checks the handler export, source-map metadata,
packaged file inventory, SPA assets, and the health fallback when the database
is unavailable. AWS deployment is deliberately a separate, explicitly
authorized operation after local and account-level migration smoke checks.

`openapi.json` is the committed public contract. It documents the routes,
trailing slashes, numeric IDs, JWT header, and structured error payloads.
