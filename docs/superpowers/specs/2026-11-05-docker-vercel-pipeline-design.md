# Docker pipeline: lint, test, build, deploy to Vercel

Date: 2026-11-05
Status: Draft, awaiting review

## Goal

One Docker-based pipeline that, on every change, lints and tests Inkwell, and on
`main` also migrates the production database and deploys to Vercel production.
The same Dockerfile also produces a self-hostable runtime image of the app.

Success looks like:

- A PR with a lint error, failing unit test or failing integration test cannot
  pass the pipeline.
- A push to `main` that passes all checks ends with a live Vercel production
  deployment whose database schema matches `prisma/migrations`.
- A failed migration stops the pipeline before deploy; the previously live
  deployment keeps serving.
- No secret is ever written into an image layer.

## Decisions (from the brainstorm)

| Topic | Decision |
|---|---|
| Where it runs | GitHub Actions (assumed: repo is on GitHub). Dockerfile itself is CI-agnostic. |
| Integration tests | Run in the pipeline against a disposable `postgres:17` container. |
| Migrations | `prisma migrate deploy` against production before deploy; any failure aborts. |
| Deploy target | Vercel production only, from `main`. No preview deploys. |
| Runtime image | Yes: `runner` stage, published to GHCR on `main`. |
| Vercel project / env vars | Do not exist yet; user creates them (see One-time setup). |

## Facts about the repo this design depends on

- Package manager is Bun 1.3.13 (`packageManager` in `package.json`), lockfile `bun.lock`.
- `postinstall` runs `prisma generate`; the client is generated into
  `src/generated/prisma`, so `prisma/` and `prisma.config.ts` must be present
  at install time.
- `prisma.config.ts` imports `dotenv/config` and reads `DATABASE_URL`.
- Lint: `oxlint --type-aware --deny-warnings`.
- Unit tests: `bun run test` (Jest, no DB).
- Integration tests: `bun run test:integration`. Global setup creates the test
  database and runs `npx prisma migrate deploy`, so **Node/npx must be on PATH**.
  The DB name must end in `_test`; `TEST_DATABASE_URL` takes precedence.
- `next build` runs on Node (the `next` bin has a node shebang), so the image
  needs Node as well as Bun.
- Next 16 standalone output (`output: "standalone"`) produces
  `.next/standalone/server.js`; `public/` and `.next/static/` must be copied in
  manually (per `node_modules/next/dist/docs/.../next-config-js/output.md`).

## Files

| File | New/changed | Purpose |
|---|---|---|
| `Dockerfile` | new | Multi-stage: one stage per pipeline step + runtime + deployer |
| `.dockerignore` | new | Exclude `node_modules`, `.next`, `.swc`, `.env*`, `.vercel`, `.git`, `src/generated`, `coverage`, `*.tsbuildinfo` |
| `docker-compose.ci.yml` | new | `postgres` + `integration` services for integration tests |
| `scripts/deploy.sh` | new | Ordered, fail-fast deploy (Vercel build → migrate → deploy) |
| `.github/workflows/pipeline.yml` | new | Orchestrates the stages |
| `next.config.ts` | changed | Add `output: "standalone"` (Vercel ignores this setting) |

## Dockerfile stages

All stages pin versions; no `latest` tags.

1. **`base`**: `node:22-bookworm-slim`, plus `COPY --from=oven/bun:1.3.13
   /usr/local/bin/bun /usr/local/bin/bun`. `WORKDIR /app`.
2. **`deps`** (from `base`): copy `package.json`, `bun.lock`,
   `prisma.config.ts`, `prisma/`; run `bun install --frozen-lockfile`.
   Cached until lockfile or schema changes.
3. **`source`** (from `deps`): copy the rest of the repo (filtered by
   `.dockerignore`). Shared parent of the check stages.
4. **`lint`** (from `source`): `RUN bun run lint`.
5. **`test`** (from `source`): `RUN bun run test`.
6. **`integration`** (from `source`): `CMD ["bun", "run", "test:integration"]`.
   Runs as a container, not at build time, because it needs a live database.
7. **`build`** (from `source`): `RUN bun run build`, then copy `public` and
   `.next/static` into `.next/standalone`. `NEXT_TELEMETRY_DISABLED=1`.
   Build-time env: placeholder values only if the build requires the variables
   to exist (see Open risks); never real secrets.
8. **`runner`** (from `node:22-bookworm-slim`, no Bun): non-root `nextjs`
   user, copies only `.next/standalone`; `ENV NODE_ENV=production PORT=3000
   HOSTNAME=0.0.0.0`; `EXPOSE 3000`; `HEALTHCHECK` hitting `/` via a short
   `node -e "fetch(...)"`; `CMD ["node", "server.js"]`. Runtime env
   (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) is supplied by
   whoever runs the container.
9. **`deployer`** (from `source`): installs a pinned `vercel` CLI globally,
   copies `scripts/deploy.sh`, `ENTRYPOINT ["/app/scripts/deploy.sh"]`.

Lint and unit-test stages are build-time `RUN` steps on purpose: a failing
check fails `docker build --target lint|test`, which is all CI needs.

## Integration tests (`docker-compose.ci.yml`)

- `postgres`: `postgres:17-alpine`, user/password `postgres`/`postgres`,
  healthcheck `pg_isready`, tmpfs data dir (thrown away after the run).
- `integration`: built from `Dockerfile` target `integration`,
  `depends_on: postgres: condition: service_healthy`,
  `TEST_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/inkwell_test`.
- CI runs `docker compose -f docker-compose.ci.yml run --rm integration`
  then `docker compose ... down -v` (always, even on failure).

## Deploy (`scripts/deploy.sh`)

`#!/usr/bin/env bash` with `set -euo pipefail`. Required env, checked up front
with a clear error if missing: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`. Optional: `DIRECT_DATABASE_URL`.

Steps, in this order:

1. `vercel pull --yes --environment=production --token "$VERCEL_TOKEN"`:
   fetches project settings and production env vars into `.vercel/`.
2. `vercel build --prod --token "$VERCEL_TOKEN"`: builds the deployable
   output. **No DB changes yet**, so a build failure leaves production fully
   untouched.
3. Migrate: load `DATABASE_URL` from `.vercel/.env.production.local`; if
   `DIRECT_DATABASE_URL` is set, use it instead (pooled URLs from Neon/Supabase
   break migrations). Run `bunx prisma migrate deploy`. Non-zero exit aborts
   the script; nothing is deployed.
4. `vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN"`: uploads the
   build from step 2. Prints the deployment URL.

The token is never echoed; the script never runs with `set -x`.

### Migration failure semantics

- Postgres runs each Prisma migration in a transaction, so a failed migration
  does not leave partial changes (except statements that cannot run in a
  transaction, e.g. `CREATE INDEX CONCURRENTLY`).
- Prisma records the migration as failed; further `migrate deploy` runs refuse
  to proceed until someone runs `prisma migrate resolve`. This is intended: a
  human looks before the next deploy.
- There is no automatic schema rollback (Prisma has no down migrations).
- Because migrations run before the new code is live, each migration must be
  compatible with the currently deployed code (expand first, contract in a
  later deploy). This is a team convention, not something the pipeline enforces.

## GitHub Actions workflow (`.github/workflows/pipeline.yml`)

Triggers: `pull_request` (any branch) and `push` to `main`.

Jobs:

| Job | Runs on | Needs | Does |
|---|---|---|---|
| `lint` | PR + main | — | `docker build --target lint .` |
| `unit` | PR + main | — | `docker build --target test .` |
| `integration` | PR + main | — | compose run as above |
| `build` | PR + main | lint, unit, integration | `docker build --target runner .`; on `main` push to `ghcr.io/zaidhamarneh/inkwell:{sha,latest}` |
| `deploy` | main only | build | `docker build --target deployer .` then `docker run --rm -e VERCEL_TOKEN -e VERCEL_ORG_ID -e VERCEL_PROJECT_ID -e DIRECT_DATABASE_URL <deployer>` |

- All jobs use `docker/setup-buildx-action` with the GitHub Actions cache
  (`cache-from/to: type=gha`) so the `deps` layer is shared between jobs.
- `deploy` uses GitHub environment `production` (secrets live there) and
  `concurrency: { group: production, cancel-in-progress: false }`, so two
  deploys never migrate at the same time and a running deploy is never killed
  mid-migration.
- Workflow permissions: `contents: read`; `packages: write` only on `build`.
- Third-party actions pinned to a major version tag from the official
  `actions/*` and `docker/*` publishers.

## One-time setup (user does these; the pipeline cannot)

1. Install the Vercel CLI and run `vercel link` in the repo. Note the
   `orgId` and `projectId` from `.vercel/project.json` (gitignored).
2. In the Vercel dashboard, add Production env vars: `DATABASE_URL`,
   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the production URL).
3. Create a Vercel access token.
4. In GitHub → Settings → Environments, create `production` and add secrets
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and, if the DB uses a
   pooler, `DIRECT_DATABASE_URL`.
5. Do **not** connect Vercel's Git integration (it would deploy every push a
   second time). If it is already connected, disable automatic deployments.

## Verification

Before calling the implementation done:

- `docker build --target lint .`, `--target test .` and `--target runner .`
  succeed locally.
- `docker compose -f docker-compose.ci.yml run --rm integration` passes.
- The `runner` image starts with a real `DATABASE_URL` and answers on
  `http://localhost:3000`; healthcheck reports healthy.
- A deliberately broken lint rule / failing test fails the matching target.
- `deploy.sh` exits non-zero with a clear message when a required env var is
  missing (checked without real credentials).
- The real Vercel deploy can only be verified after one-time setup; the first
  `main` run is the end-to-end check.

## Out of scope

- Preview deployments for PRs.
- Running the `runner` image anywhere (it is built and published only).
- Seeding production data.
- Automatic migration rollback.

## Open risks

- **Build-time env:** if `next build` (or `vercel build`) evaluates code that
  requires `DATABASE_URL` / `BETTER_AUTH_SECRET` to exist, the `build` stage
  needs placeholder values via `ARG`. Will be discovered on the first build and
  handled with non-secret placeholders.
- **Prerendering hitting the DB:** with `cacheComponents`, any page that reads
  the DB at build time would need a reachable DB during build. Not expected,
  but checked on first build.
