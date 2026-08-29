# Fitness Tracker

Fitness Tracker is a React/Vite application backed by a TypeScript Lambda
handler. The API and the built SPA are packaged together for AWS SAM and can
be run locally against DynamoDB Local.

## Stack

- **API:** TypeScript, Node.js 24, AWS Lambda Function URL
- **Data:** DynamoDB (pay-per-request in AWS)
- **Web:** React, TypeScript, Vite, Tailwind CSS
- **Authentication:** JWT with PBKDF2-compatible password hashes
- **Tests:** Node's test runner, Vitest, and Playwright

## Run locally

Prerequisites are Node.js 24+, Java (for DynamoDB Local), and npm.

Install each workspace once:

```sh
cd backend-ts && npm ci
cd ../web && npm ci
cd ../e2e && npm ci && npm run install:browsers
```

Run the complete browser flow with a deterministic local database and seed:

```sh
./e2e/run-local-ts.sh
```

To exercise the exact SAM-built Lambda and packaged SPA locally:

```sh
./e2e/run-sam-ts.sh
```

For interactive development, run the API and Vite separately:

```sh
# terminal 1
cd backend-ts
npm run dev

# terminal 2
cd web
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

The API listens on `http://127.0.0.1:8000`; Vite listens on
`http://127.0.0.1:5173`.

The committed browser fixture contains the demo accounts `admin/admin`,
`test/test`, and `test2/test2`. It is loaded only by the local E2E runners.

## Tests and builds

```sh
cd backend-ts
npm run typecheck
npm run test:integration
npm run build
npm run verify:artifact

cd ../web
npm test
npm run build
```

The integration suite provisions an in-memory DynamoDB Local table and invokes
the real handler. `verify:artifact` builds the SAM package and checks that the
deployable handler and SPA are self-contained.

## SQLite migration rehearsal

The one-time exporter reads an existing SQLite file without requiring an
application runtime. It writes the versioned snapshot consumed by the DynamoDB
migration loader:

```sh
cd backend-ts
npm run export:sqlite -- /absolute/path/to/source.sqlite .tmp/migration-snapshot.json
npm run rehearsal:migration -- .tmp/migration-snapshot.json
```

The rehearsal refuses to write into a non-empty table, preserves numeric IDs,
seeds all runtime counters, and verifies every imported item.

## Project layout

```text
fitness-tracker/
├── backend-ts/       # TypeScript Lambda, repository, migration tools, tests
├── web/               # React/Vite frontend
├── e2e/               # Playwright tests and local runners
├── docs/              # API contract and migration decisions
└── Makefile           # Common local commands
```

## API

The handler preserves the existing `/api/.../` routes, numeric IDs, JWT
`Authorization: Bearer` header, and DRF-compatible error payloads. The
committed contract is [backend-ts/openapi.json](backend-ts/openapi.json).

## AWS packaging

The SAM template is [backend-ts/template.yaml](backend-ts/template.yaml).
Build it locally before any deployment:

```sh
cd backend-ts
npm run build:cutover
sam build --template template.yaml
```

AWS deployment is intentionally a separate, explicitly authorized step after
the local checks above and a migration smoke test against the target account.
