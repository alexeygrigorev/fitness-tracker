.PHONY: dev dev-backend dev-frontend build test test-backend test-frontend test-e2e test-sam clean export-backend-contract export-sqlite-snapshot migration-rehearsal verify-artifact deploy

dev:
	@echo "Starting frontend and TypeScript backend..."
	@make -j2 dev-backend dev-frontend

dev-backend:
	@echo "Starting TypeScript backend..."
	cd backend-ts && npm run dev

dev-frontend:
	@echo "Starting Vite frontend..."
	cd web && npm run dev

build:
	cd web && npm run build

test: test-backend test-frontend

test-backend:
	cd backend-ts && npm run typecheck && npm run test:integration

test-frontend:
	cd web && npm test

test-e2e:
	bash ./e2e/run-local-ts.sh

test-sam:
	bash ./e2e/run-sam-ts.sh

export-backend-contract:
	@echo "The committed API contract is backend-ts/openapi.json."
	@echo "Regenerate it only from an intentional contract change."

export-sqlite-snapshot:
	@test -n "$(SQLITE_DB)" || (echo "Set SQLITE_DB=/path/to/source.sqlite" >&2; exit 1)
	cd backend-ts && npm run export:sqlite -- "$(SQLITE_DB)" "$(or $(SNAPSHOT_FILE),.tmp/migration-snapshot.json)"

migration-rehearsal:
	cd backend-ts && npm run rehearsal:migration -- "$(or $(SNAPSHOT_FILE),.tmp/migration-snapshot.json)"

verify-artifact:
	cd backend-ts && npm run verify:artifact

clean:
	cd backend-ts && npm run clean
	cd web && rm -rf dist node_modules/.vite

deploy:
	@echo "Deployment is intentionally not run by this target."
	@echo "After AWS approval, run: cd backend-ts && sam deploy --guided"
