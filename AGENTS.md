## Git workflow

Do all work directly on `main` unless multiple agents are running in parallel. Use separate worktrees or branches only to isolate parallel agent work, and merge that work back into `main` when it is complete.

## Use UV for Python Package Management

When installing Python packages, use `uv` instead of `pip`. See `/uv` for details.

❌ WRONG:
```bash
pip install djangorestframework
```

✅ CORRECT:
```bash
cd backend-django
uv add djangorestframework
```

Run Django commands:
```bash
cd backend-django
uv run python manage.py makemigrations
uv run python manage.py migrate
uv run python manage.py test
```


## One-time tests and debug scripts


One-time scripts and temporary files should be in .tmp. It's in .gitignore so we won't accidentally commit it to git.
