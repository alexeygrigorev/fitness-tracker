# Working instructions

## Git workflow

Do all work directly on `main` unless multiple agents are running in parallel.
Use separate worktrees or branches only to isolate parallel agent work, and
merge that work back into `main` when it is complete.

## Node package management

Use `npm ci` for clean installs and `npm run` scripts from the workspace being
changed (`backend-ts`, `web`, or `e2e`).

## One-time tests and debug scripts

Keep one-time scripts and temporary files in `.tmp`; it is ignored so they are
not accidentally committed.
