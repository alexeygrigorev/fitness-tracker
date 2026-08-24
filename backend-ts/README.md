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
npm run verify:artifact
```

Integration tests launch official DynamoDB Local, so Java must be installed.
They invoke the real handler against an in-memory table. The SAM artifact is
built from the same bundled handler. The artifact verifier builds that payload
again and checks the handler export, source-map metadata, packaged-file
inventory, and database-unreachable health fallback:

```sh
sam build
sam deploy --guided --parameter-overrides \
  JwtSecret='<50+-character-secret>' \
  AllowedOrigins='https://fitness.example'
```

Set `AllowedOrigins` to the exact comma-separated browser origins that call the
API. A same-origin SPA needs no value; a local Vite frontend uses
`http://localhost:5173`.

## Frontend cutover artifact

Django remains the active serving backend while parity gates are open. The
Lambda stack is prepared for its eventual same-origin SPA without switching any
traffic now. Build the React app with an empty `VITE_API_URL`, copy it into the
SAM function artifact, and let the default `FrontendBuild` resolve to
`/var/task/frontend` inside Lambda:

```sh
npm run build:cutover
sam build
sam deploy --guided --parameter-overrides \
  JwtSecret='<50+-character-secret>' \
  AllowedOrigins=''
```

The table retains data on stack updates/deletion. User IDs come from atomic
counters so migrated SQLite IDs remain stable. Exercise settings are scoped to
the authenticated user and require a canonical or owner-owned exercise item.

## SQLite migration rehearsal

Export a migrated SQLite database, then load it into a disposable empty
DynamoDB Local table. The loader refuses a nonempty target, preserves source
numeric IDs, seeds every runtime counter, retries throttled batch writes, and
deep-compares a consistent read of every loaded item.

```sh
cd backend-django
DB_PATH=/absolute/path/to/source.sqlite uv run python manage.py migrate
DB_PATH=/absolute/path/to/source.sqlite uv run python manage.py \
  export_migration_snapshot --output ../backend-ts/.tmp/migration-snapshot.json

cd ../backend-ts
npm run rehearsal:migration
```
