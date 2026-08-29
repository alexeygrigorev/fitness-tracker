# TypeScript serverless backend

The TypeScript Lambda is the sole application backend. It serves the existing
REST contract through an AWS Lambda Function URL and stores records in a
single DynamoDB table. The React SPA is packaged into the same SAM artifact so
the production path can be same-origin.

## Local verification

The following commands exercise the same handler at every layer:

```sh
cd backend-ts
npm ci
npm run typecheck
npm run test:integration
npm run build:cutover
npm run verify:artifact

cd ../e2e
npm ci
npm run install:browsers
./run-local-ts.sh
./run-sam-ts.sh
```

The two Playwright runners use DynamoDB Local and a deterministic fixture. The
first uses the compiled source handler; the second starts the handler bundled
by `sam build` and the packaged SPA. No deployed service is required for
these checks.

## Data migration

For an existing SQLite file, export a snapshot and rehearse it into an empty
DynamoDB Local table:

```sh
cd backend-ts
npm run export:sqlite -- /absolute/path/to/source.sqlite .tmp/migration-snapshot.json
npm run rehearsal:migration -- .tmp/migration-snapshot.json
```

The exporter is read-only, versioned, and preserves public numeric IDs. The
rehearsal validates foreign keys, writes in retryable batches, seeds counters,
and verifies every resulting record.

## Deployment boundary

`backend-ts/template.yaml` defines Node.js 24 ARM64, least-privilege table
access, pay-per-request billing, point-in-time recovery, and a public Function
URL whose application code performs JWT authorization and CORS checks.

CI runs typechecking, integration tests, frontend tests, the local browser
flow, and SAM artifact verification. It intentionally does not deploy to AWS;
deployment should be an explicit follow-up after credentials, migration
smoke tests, and the production origin are approved.
