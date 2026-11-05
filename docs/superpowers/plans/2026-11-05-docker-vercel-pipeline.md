# Docker → Vercel Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A multi-stage Dockerfile plus GitHub Actions workflow that lints, unit-tests and integration-tests Inkwell on every PR/push, and on `main` publishes a runtime image and deploys to Vercel production after a fail-fast Prisma migration.

**Architecture:** One `Dockerfile` with a stage per pipeline step (`lint`, `test`, `integration`, `build`, `runner`, `deployer`) sharing a cached `deps` layer. Integration tests run against a disposable Postgres via `docker-compose.ci.yml`. `scripts/deploy.sh` performs Vercel pull → Vercel build → `prisma migrate deploy` → `vercel deploy --prebuilt`, aborting at the first failure. A GitHub Actions workflow orchestrates it.

**Tech Stack:** Docker (BuildKit/buildx), Docker Compose v2, `node:22-bookworm-slim`, Bun 1.3.13, Next 16.4.5 standalone output, Prisma 7.10.1, Vercel CLI, GitHub Actions, GHCR.

**Spec:** `docs/superpowers/specs/2026-11-05-docker-vercel-pipeline-design.md`

## Global Constraints

- **Do not commit.** The user commits their own work. Each task ends with a checkpoint (`git status`), not a commit.
- Do not touch `README.md` (it has uncommitted user edits).
- Base image `node:22-bookworm-slim`; Bun is copied from `oven/bun:1.3.13` (matches `packageManager`). No `latest` tags anywhere.
- Postgres for tests: `postgres:17-alpine`.
- Vercel CLI pinned to an exact version via `ARG VERCEL_CLI_VERSION`. At implementation time, set it to the version `npm view vercel version` reports.
- Secrets are only ever passed as runtime env (`docker run -e`). Never use `ARG`/`ENV`/`COPY` for them.
- Deploy target: Vercel **production** only, from pushes to `main`.
- `NEXT_TELEMETRY_DISABLED=1` in all build stages.
- Before writing Next-specific config, read `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md` (AGENTS.md rule).

## Review Focus

1. **CRLF line endings from a Windows checkout.** `scripts/*.sh` must run in Linux containers. Expect `.gitattributes` to force LF and the deployer image to contain no `\r` in `deploy.sh` (test in Task 4).
2. **A real `.env` leaking into an image.** The repo root has a real `.env`. Expect it to be absent from every image (test in Task 1).
3. **DB passwords with shell-special characters** (`$`, `&`, `%24`). Expect `DATABASE_URL` to reach Prisma byte-for-byte; never `source` the pulled env file (test in Task 4).
4. **Pulled Vercel env has no `DATABASE_URL` and no `DIRECT_DATABASE_URL` is set.** Expect a clear error and no migrate/deploy call (test in Task 4).
5. **A failed integration run leaving Postgres behind.** Expect `down -v` to run even on failure and leave nothing running (test in Task 2; `if: always()` in Task 5).

---

### Task 1: Base, deps, lint and unit-test stages + `.dockerignore`

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Produces: Dockerfile stages `base`, `deps`, `source`, `lint`, `test`. WORKDIR `/app`. `source` contains the full repo minus `.dockerignore`, with `node_modules` and `src/generated/prisma` produced inside the image.

- [ ] **Step 1: Confirm Docker is available**

Run: `docker version` and `docker compose version`
Expected: both print a server/engine version. If not, stop and ask the user to start Docker Desktop.

- [ ] **Step 2: Run the targets to verify they fail**

Run: `docker build --target lint .`
Expected: FAIL (no Dockerfile / target `lint` not found).

- [ ] **Step 3: Write `.dockerignore`**

Exclude: `node_modules`, `.next`, `.swc`, `.git`, `.env*` (but keep `!.env.example`), `.vercel`, `src/generated`, `coverage`, `*.tsbuildinfo`, `.claude`, `docs`.

- [ ] **Step 4: Write stages `base` → `deps` → `source` → `lint` → `test`**

- `base`: `FROM node:22-bookworm-slim`, `COPY --from=oven/bun:1.3.13 /usr/local/bin/bun /usr/local/bin/bun`, `RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx`, `WORKDIR /app`, `ENV NEXT_TELEMETRY_DISABLED=1`.
- `deps`: copy `package.json bun.lock prisma.config.ts` and `prisma/`, then `RUN bun install --frozen-lockfile`. If `prisma generate` (postinstall) complains about a missing `DATABASE_URL`, set a non-secret placeholder for that `RUN` only: `DATABASE_URL=postgresql://placeholder@localhost:5432/placeholder`.
- `source`: `FROM deps`, `COPY . .`
- `lint`: `FROM source`, `RUN bun run lint`
- `test`: `FROM source`, `RUN bun run test`

- [ ] **Step 5: Run the targets to verify they pass**

Run: `docker build --target lint -t inkwell-lint .`, then `docker build --target test .`
Expected: both succeed. The second build reuses the cached `deps` layer.

- [ ] **Step 6: Test that a broken check fails the build**

Temporarily add `const unused = 1;` to any `src/**/*.ts` file, then run `docker build --target lint .`.
Expected: FAIL with an oxlint error. **Revert the edit** and confirm with `git status` that the file is clean.

- [ ] **Step 7: Test that no `.env` reaches the image (Review Focus 2)**

Run: `docker run --rm inkwell-lint sh -c 'test ! -e .env && test ! -e .vercel && test -e .env.example && echo OK'`
Expected: prints `OK`.

- [ ] **Step 8: Checkpoint**

Run `git status`. Expected new files: `Dockerfile`, `.dockerignore`. Do not commit.

---

### Task 2: Integration-test stage + `docker-compose.ci.yml`

**Files:**
- Modify: `Dockerfile` (add `integration` stage after `test`)
- Create: `docker-compose.ci.yml`

**Interfaces:**
- Consumes: `source` stage (Task 1).
- Produces: compose services `postgres` and `integration`. The `integration` image is tagged `inkwell-integration:ci`. The run command is `docker compose -f docker-compose.ci.yml run --rm integration`; teardown is `docker compose -f docker-compose.ci.yml down -v`.

- [ ] **Step 1: Run to verify it fails**

Run: `docker compose -f docker-compose.ci.yml run --rm integration`
Expected: FAIL (file does not exist).

- [ ] **Step 2: Add the stage `integration`**

`FROM source`, `CMD ["bun", "run", "test:integration"]`. This is not a `RUN`, because it needs a live DB.

- [ ] **Step 3: Write `docker-compose.ci.yml`**

- `postgres`:
  - image `postgres:17-alpine`
  - env `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`
  - `tmpfs: /var/lib/postgresql/data`
  - healthcheck `pg_isready -U postgres`, interval 2s, retries 15
- `integration`:
  - `build: { context: ., target: integration }`, `image: inkwell-integration:ci`
  - `depends_on: { postgres: { condition: service_healthy } }`
  - env `TEST_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/inkwell_test`, plus `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` test placeholders. Set the placeholders only if the integration tests need them; check `src/**/__tests__/*.integration.test.ts` and `src/shared/db/db.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose -f docker-compose.ci.yml run --rm integration`
Expected: Jest reports all integration suites passed and the command exits 0.

- [ ] **Step 5: Test teardown after a failure (Review Focus 5)**

Run: `docker compose -f docker-compose.ci.yml run --rm -e TEST_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/not_a_test_db integration`
Expected: FAIL with `Refusing to run integration tests against "not_a_test_db"`.
Then run `docker compose -f docker-compose.ci.yml down -v` followed by `docker compose -f docker-compose.ci.yml ps -a -q`.
Expected: the `ps` prints nothing.

- [ ] **Step 6: Checkpoint**

Run `git status`. Do not commit.

---

### Task 3: Standalone build + `runner` image

**Files:**
- Modify: `next.config.ts` (add `output: "standalone"`)
- Modify: `Dockerfile` (add `build` and `runner` stages)

**Interfaces:**
- Consumes: `source` stage.
- Produces: the `runner` stage. It serves on port 3000 as a non-root user and reads `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` at runtime. The local tag is `inkwell-runner`.

- [ ] **Step 1: Run to verify it fails**

Run: `docker build --target runner -t inkwell-runner .`
Expected: FAIL (target not found).

- [ ] **Step 2: Add `output: "standalone"` to the existing `nextConfig` object in `next.config.ts`**

Leave the existing keys untouched.

- [ ] **Step 3: Add stage `build`**

`FROM source`, `RUN bun run build`, then `RUN cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/`.

If the build fails because env vars are missing (spec Open risk), add non-secret placeholder `ARG`s scoped to this stage, for example `ARG BETTER_AUTH_SECRET=build-placeholder`. If the build fails because a page queries the DB at build time, stop and report it to the user; do not work around it silently.

- [ ] **Step 4: Add stage `runner`**

- `FROM node:22-bookworm-slim`, `WORKDIR /app`
- `ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1`
- Create system user `nextjs` with uid 1001 and group `nodejs` with gid 1001.
- `COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./`
- `USER nextjs`, `EXPOSE 3000`
- `HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"`
- `CMD ["node", "server.js"]`

- [ ] **Step 5: Build and verify it is not root**

Run: `docker build --target runner -t inkwell-runner .`, then `docker run --rm --entrypoint id inkwell-runner -u`
Expected: build succeeds; prints `1001`.

- [ ] **Step 6: Verify the image serves and becomes healthy**

1. Start a DB: `docker compose -f docker-compose.ci.yml up -d postgres`
2. Apply migrations: `docker run --rm --network inkwell_default -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/inkwell inkwell-lint bunx prisma migrate deploy`
   - The network name is `<project>_default`. Confirm it with `docker network ls`.
3. Start the app: `docker run -d --name inkwell-smoke --network inkwell_default -p 3000:3000 -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/inkwell -e BETTER_AUTH_SECRET=smoke-test-secret-0123456789abcdef -e BETTER_AUTH_URL=http://localhost:3000 inkwell-runner`
4. Check it: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` should return `200`, and after about 30s `docker inspect -f '{{.State.Health.Status}}' inkwell-smoke` should return `healthy`.
5. Clean up: `docker rm -f inkwell-smoke` and `docker compose -f docker-compose.ci.yml down -v`.

Note: `prisma migrate deploy` creates the `inkwell` DB if it doesn't exist. If it doesn't, create it with `createdb` via `docker compose exec postgres`.

- [ ] **Step 7: Checkpoint**

Run `git status`. Expected: `next.config.ts` modified and `Dockerfile` updated. Do not commit.

---

### Task 4: `deploy.sh` + `deployer` stage (fail-fast ordering)

**Files:**
- Create: `scripts/deploy.sh`
- Create: `scripts/deploy.test.sh`
- Create: `.gitattributes`
- Modify: `Dockerfile` (add `deployer` stage)

**Interfaces:**
- Consumes: `source` stage.
- Produces: the `deployer` stage (local tag `inkwell-deployer`) with `ENTRYPOINT ["bash", "/app/scripts/deploy.sh"]`. Its runtime env contract is: required `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; optional `DIRECT_DATABASE_URL`. It exits 0 only if deploy succeeded.
- Exact external commands, in order (stubs in the test match these):
  1. `vercel pull --yes --environment=production --token "$VERCEL_TOKEN"`
  2. `vercel build --prod --token "$VERCEL_TOKEN"`
  3. `bunx prisma migrate deploy` with `DATABASE_URL` exported
  4. `vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN"`

- [ ] **Step 1: Write `.gitattributes`**

`*.sh text eol=lf` and `Dockerfile text eol=lf`.

- [ ] **Step 2: Write the failing test `scripts/deploy.test.sh`**

It is a plain bash script with `set -u`, and each case runs in a fresh `mktemp -d` working dir.

Stubs go in a temp `bin/` dir prepended to `PATH`:

- **`vercel`** appends `vercel $*` to `$CALLS`. On `pull` it writes `.vercel/.env.production.local` containing `PULLED_ENV_CONTENT`, which defaults to `DATABASE_URL="postgres://u:p%24ss$w&rd@pulled:5432/db"`. On `build` it exits with `${VERCEL_BUILD_EXIT:-0}`.
- **`bunx`** appends `bunx $* DATABASE_URL=<value>` to `$CALLS` and exits with `${MIGRATE_EXIT:-0}`.

Each case asserts and prints `PASS <name>` or `FAIL <name>`. The script exits non-zero if any case fails.

| Case | Setup | Assertions |
|---|---|---|
| `missing_token` | unset `VERCEL_TOKEN` | exit ≠ 0; stderr contains `VERCEL_TOKEN`; `$CALLS` empty |
| `happy_path` | all env set | exit 0; `$CALLS` lines in order: `vercel pull …`, `vercel build …`, `bunx prisma migrate deploy DATABASE_URL=postgres://u:p%24ss$w&rd@pulled:5432/db`, `vercel deploy --prebuilt --prod …` |
| `direct_url_wins` | `DIRECT_DATABASE_URL=postgres://direct/db` | the `bunx` line ends with `DATABASE_URL=postgres://direct/db` |
| `build_fails` | `VERCEL_BUILD_EXIT=1` | exit ≠ 0; no `bunx` line; no `deploy` line |
| `migrate_fails` | `MIGRATE_EXIT=1` | exit ≠ 0; no `vercel deploy` line |
| `no_db_url` | `PULLED_ENV_CONTENT='OTHER=1'`, no `DIRECT_DATABASE_URL` | exit ≠ 0; stderr contains `DATABASE_URL`; no `bunx` or `deploy` line |
| `token_not_printed` | `VERCEL_TOKEN=tok_secret_123` (happy path) | combined stdout+stderr does not contain `tok_secret_123` |

- [ ] **Step 3: Run the test to verify it fails**

Run: `bash scripts/deploy.test.sh` in Git Bash.
Expected: FAIL (`scripts/deploy.sh` not found), and the script exits non-zero.

- [ ] **Step 4: Implement `scripts/deploy.sh`**

- Use `#!/usr/bin/env bash` and `set -euo pipefail`. Never use `set -x`.
- Write a `require_env` check for the three required vars. On a missing var, print `deploy: <NAME> is required` to stderr and exit 1.
- Run the four commands from the Interfaces block in order, printing a one-line `==> step` banner before each.
- Resolve `DATABASE_URL` without sourcing the file:
  - If `DIRECT_DATABASE_URL` is set, use it.
  - Otherwise read the first `^DATABASE_URL=` line of `.vercel/.env.production.local`, strip the key and any single pair of surrounding double quotes, and take the value literally.
  - If neither yields a value, print `deploy: no DATABASE_URL in Vercel production env and DIRECT_DATABASE_URL not set` and exit 1 before migrating.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bash scripts/deploy.test.sh`
Expected: 7 × `PASS`, exit 0.

- [ ] **Step 6: Add the `deployer` stage**

- `FROM source`
- `ARG VERCEL_CLI_VERSION=<exact version>`
- `RUN bun add --global vercel@${VERCEL_CLI_VERSION}`. If the global bin isn't on `PATH`, use `npm install -g vercel@${VERCEL_CLI_VERSION}` instead.
- `ENTRYPOINT ["bash", "/app/scripts/deploy.sh"]`

- [ ] **Step 7: Verify inside the image (Review Focus 1)**

Run:
- `docker build --target deployer -t inkwell-deployer .`
- `docker run --rm --entrypoint bash inkwell-deployer scripts/deploy.test.sh`
- `docker run --rm --entrypoint sh inkwell-deployer -c "grep -c $(printf '\r') scripts/deploy.sh || true"`
- `docker run --rm inkwell-deployer`

Expected:
- the in-image test prints 7 × `PASS`;
- the CR count prints `0`;
- the last command exits 1 with `deploy: VERCEL_TOKEN is required`.

- [ ] **Step 8: Checkpoint**

Run `git status`. Do not commit.

---

### Task 5: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/pipeline.yml`

**Interfaces:**
- Consumes: all Dockerfile targets, `docker-compose.ci.yml`, and the deployer env contract (Task 4).
- Produces: jobs `lint`, `unit`, `integration`, `build`, `deploy`.
  - GitHub environment: `production`.
  - Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DIRECT_DATABASE_URL` (optional).
  - Image: `ghcr.io/${{ github.repository_owner }}/inkwell:{sha,latest}`.

- [ ] **Step 1: Run the linter to verify it fails**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color`
Expected: no workflow file found, or the run fails.

- [ ] **Step 2: Write the workflow**

- **Triggers:** `on: pull_request` and `push: branches: [main]`. Top-level `permissions: contents: read`.
- **Every job:** `actions/checkout@v5` and `docker/setup-buildx-action@v3`. Builds use `docker/build-push-action@v6` with `cache-from: type=gha` and `cache-to: type=gha,mode=max`.
- **`lint` / `unit`:** `target: lint` / `target: test`, `push: false`.
- **`integration`:**
  1. Build `target: integration` with `load: true` and `tags: inkwell-integration:ci`.
  2. Run `docker compose -f docker-compose.ci.yml run --rm integration`.
  3. Add a final step with `if: always()` that runs `docker compose -f docker-compose.ci.yml down -v` (Review Focus 5).
- **`build`:**
  - `needs: [lint, unit, integration]`, `permissions: { contents: read, packages: write }`, `target: runner`.
  - Add `docker/login-action@v3` to `ghcr.io` with `GITHUB_TOKEN`, only on main.
  - `push: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}`.
- **`deploy`:**
  - `needs: build`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `environment: production`.
  - `concurrency: { group: production, cancel-in-progress: false }`.
  - Build `target: deployer` with `load: true` and `tags: inkwell-deployer`.
  - Then run `docker run --rm -e VERCEL_TOKEN -e VERCEL_ORG_ID -e VERCEL_PROJECT_ID -e DIRECT_DATABASE_URL inkwell-deployer` with the step's `env:` mapped from `secrets.*`.

- [ ] **Step 3: Run the linter to verify it passes**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color`
Expected: no output, exit 0.

- [ ] **Step 4: Check the guards with grep**

In `.github/workflows/pipeline.yml`, confirm all four:
- `cancel-in-progress: false`
- `environment: production`
- `if: always()`
- the `deploy` job's `if:` includes `refs/heads/main`

- [ ] **Step 5: Checkpoint**

Run `git status`. Do not commit.

---

### Task 6: End-to-end local verification

**Files:** none (verification only)

- [ ] **Step 1: Re-run the full local pipeline from a clean cache**

Run, in order:
- `docker builder prune -f`
- `docker build --target lint .`
- `docker build --target test .`
- `docker compose -f docker-compose.ci.yml run --rm integration` followed by `docker compose -f docker-compose.ci.yml down -v`
- `docker build --target runner .`
- `docker build --target deployer .`

Expected: every command exits 0.

- [ ] **Step 2: Report to the user**

Summarize what passed. State plainly that the real Vercel deploy and the GHCR push are **unverified** until the one-time setup in the spec is done and the first push to `main` runs. List the setup steps from the spec. Do not commit.
