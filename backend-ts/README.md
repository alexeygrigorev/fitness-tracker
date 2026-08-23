# TypeScript Backend Foundation

This is the first deployable slice of the locked TypeScript replacement. It is
intentionally independent of `backend-django`; the Python API remains the
source of truth until every gate in `docs/backend-parity-lock.json` passes.

The foundation includes the monolithic Function URL Lambda, strict runtime
configuration, single-table access primitives, numeric ID allocation, JWT
signing/validation, Django-compatible PBKDF2 password hashes, health, auth,
user profile, and exercise-settings routes.

`openapi.json` is generated from the locked Django API. Regenerate it after an
intentional Python contract change with `make export-backend-contract`; the
Python contract tests fail when the committed artifact drifts.

```sh
npm ci
npm run typecheck
npm run test:integration
npm run build
```

Integration tests launch official DynamoDB Local, so Java must be installed.
They invoke the real handler against an in-memory table. The SAM artifact is
built from the same bundled handler:

```sh
sam build
sam deploy --guided --parameter-overrides JwtSecret='<50+-character-secret>'
```

The table retains data on stack updates/deletion. User IDs come from atomic
counters so migrated SQLite IDs remain stable. Exercise settings are scoped to
the authenticated user and require a canonical or owner-owned exercise item.
