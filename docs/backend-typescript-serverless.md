# Backend TypeScript Serverless Decision

Status: **locked** on 2026-08-23.

The replacement backend is implemented in strict TypeScript on AWS Lambda. The
old Django backend remains the source of truth until every parity gate below
passes; only then may `backend-django`, its migrations, Docker/Fly deployment
path, and Python-only tooling be removed.

## Architecture Decisions

- Use a single monolithic HTTP Lambda for API routes and the built SPA, matching
  the proven `dataops` backend pattern rather than adding API Gateway or another
  framework layer.
- Expose it through an AWS Lambda Function URL with `AuthType: NONE`; JWT
  authorization remains application-owned.
- Store data in DynamoDB using `PAY_PER_REQUEST`. This avoids RDS/ECS/Fly fixed
  costs and supports transactional writes for nested workouts and meals.
- Preserve numeric public IDs from the existing API. Internal keys may be typed,
  while response IDs remain numbers.
- Preserve exact routes, including trailing slashes, request/response field
  names, status codes, pagination-free arrays, DRF error shapes where callers
  depend on them, and camelCase domain payloads.
- Keep authentication contract-compatible: form-encoded login returns access and
  refresh JWTs plus `user`; protected requests use `Authorization: Bearer`.
- Implement password hashing with Node crypto and migrate or re-derive existing
  users through an explicit data migration rehearsal before cutover.
- Run local integration tests against DynamoDB Local/dynalite and invoke the
  real handler, not mocked repositories.
- Deploy with AWS SAM, Node.js 24 ARM64, least-privilege IAM, pay-per-request
  DynamoDB tables, and no persistent servers.

## Parity Lock

`docs/backend-parity-lock.json` is the machine-readable control file. Its
current committed baseline is 22 Python test classes and 140 passing test
methods at the reliability-lane commit `a45e087`. The final manifest must
inventory every test that exists immediately before Python deletion, not merely
this historical minimum.

## Deletion Gates

1. Every Python backend test is mapped one-to-one by intent to a TypeScript
   test, with no skipped tests unless the lock records an approved equivalent.
2. All translated TypeScript tests pass against DynamoDB Local.
3. A generated OpenAPI/contract diff proves route, schema, status, and payload
   compatibility, including documented examples.
   The canonical export is `backend-ts/openapi.json`; refresh it with `make
   export-backend-contract`.
4. Full frontend unit tests and the complete Playwright suite pass twice against
   the TypeScript backend: once locally and once from the SAM-built artifact.
5. Ownership/security boundaries receive a focused review covering users,
   exercises, sessions, sets, presets, plans, foods, meals, templates, and AI.
6. A sandbox deployment smoke test passes health, registration/login, workout,
   nutrition, and AI endpoints.
7. Existing SQLite data exports and imports successfully in a migration
   rehearsal.
8. Frontend configuration switches to the TypeScript runtime only after all
   preceding gates pass.
9. The old backend is retained until then, followed by one focused removal
   commit that also updates scripts, documentation, CI, and E2E runners.

No lane may delete Python code, disable old tests, or claim parity without
updating the lock and producing command evidence.
