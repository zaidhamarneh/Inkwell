# Inkwell

[![Pipeline](https://github.com/zaidhamarneh/Inkwell/actions/workflows/pipeline.yml/badge.svg?branch=main)](https://github.com/zaidhamarneh/Inkwell/actions/workflows/pipeline.yml)

A blogging platform: write posts, read a feed, comment and like.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, tRPC, React Query, Better Auth, Prisma and PostgreSQL, with Bun as the package manager.

Live demo: https://inkwelll-six.vercel.app/

**Architecture:** see [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) for the system design (components, data flow, data model, design patterns and design decisions).

## Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 24.x | Runs Next.js and the Prisma CLI |
| [Bun](https://bun.sh) | 1.3.13 or newer | Installs packages and runs the scripts |
| [Docker](https://www.docker.com) | any recent version | Runs PostgreSQL locally and builds the app image |

You can use your own PostgreSQL server (version 15 or newer) instead of Docker for the database.

## Running locally

### 1. Install dependencies

```bash
bun i
```

This also generates the Prisma client (`postinstall` runs `prisma generate`).

### 2. Start PostgreSQL

Create a Docker network (so the app container in step 8 can reach the database by name), then start Postgres on it. The data is kept in the `inkwell-pgdata` volume:

```bash
docker network create inkwell
```

```bash
docker run -d --name inkwell-db --network inkwell -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=inkwell -p 5432:5432 -v inkwell-pgdata:/var/lib/postgresql/data postgres:17-alpine
```

Later, stop and start it with `docker stop inkwell-db` / `docker start inkwell-db`. If port 5432 is already taken on your machine, use `-p 5433:5432` and put `5433` in `DATABASE_URL` below.

### 3. Create the `.env` file

Copy the example file:

```bash
cp .env.example .env
```

(PowerShell: `Copy-Item .env.example .env`.)

Generate a secret for Better Auth:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Then fill in `.env`:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inkwell?schema=public"
BETTER_AUTH_SECRET="<paste the generated value here>"
BETTER_AUTH_URL="http://localhost:3000"
```

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. The one above matches the Docker container from step 2. |
| `BETTER_AUTH_SECRET` | Signs and encrypts session data. At least 32 random bytes; keep it private, and use a different one per environment. Changing it signs everyone out. |
| `BETTER_AUTH_URL` | The public base URL the app is served from (`http://localhost:3000` locally, your real domain in production). Better Auth uses it to build URLs and to check the `Origin` of auth requests, so it must match the address in the browser. |

`.env` is gitignored. Never commit real secrets.

### 4. Apply the database migrations

```bash
bun run db:migrate
```

Runs `prisma migrate dev`, which creates all the tables from `prisma/migrations/`. (On a production database use `bunx prisma migrate deploy` instead, which only applies existing migrations.)

### 5. Load demo data (optional)

```bash
bun run db:seed
```

Creates 3 users, 8 posts, comments and likes. Sign in as any demo user with password `inkwell-demo-123`:

| User | Email |
| --- | --- |
| Ada Lovelace | `ada@example.com` |
| Grace Hopper | `grace@example.com` |
| Alan Turing | `alan@example.com` |

Re-running the seed resets only the demo users and their content; other accounts are left alone. These are local test credentials. Don't seed a production database.

### 6. Start the development server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Register a new account or log in with a demo user.

### 7. Run the checks (optional)

```bash
bun run test
```

```bash
bun run test:integration
```

```bash
bun run lint
```

- `test` runs unit and component tests; no database needed.
- `test:integration` needs the database from step 2. It creates, migrates and uses a separate `inkwell_test` database, so your dev data isn't touched.
- `lint` is type-aware. It generates Next's route types first (`next typegen`), so it works on a fresh clone.
- `bun run test:coverage` runs the same tests with a coverage report and fails below the thresholds in `jest.config.mjs`.

### 8. Build and run the Docker image

The `Dockerfile` has a `runner` stage: a small production image (Next.js standalone server, no dev dependencies, non-root user). Build it:

```bash
docker build --target runner -t inkwell .
```

The image doesn't contain the Prisma CLI, so migrations are applied from your machine (step 4) before the container starts. Run it on the same network as the database, passing the variables at runtime (they are never baked into the image). Note the database host is `inkwell-db` (the container name), not `localhost`:

```bash
docker run --rm --name inkwell-app --network inkwell -p 3000:3000 -e DATABASE_URL="postgresql://postgres:postgres@inkwell-db:5432/inkwell?schema=public" -e BETTER_AUTH_SECRET="<your secret>" -e BETTER_AUTH_URL="http://localhost:3000" inkwell
```

Open [http://localhost:3000](http://localhost:3000). Stop the dev server first if it's running, since both use port 3000 (or map another port, e.g. `-p 3001:3000` with `BETTER_AUTH_URL="http://localhost:3001"`).

The other Dockerfile stages run the same checks as CI:

```bash
docker build --target lint .
```

```bash
docker build --target test .
```

```bash
docker compose -f docker-compose.ci.yml run --rm integration
```

```bash
docker compose -f docker-compose.ci.yml down -v
```

The last two run the integration tests against a throwaway Postgres and then remove it.

### Cleaning up

```bash
docker rm -f inkwell-db
```

```bash
docker volume rm inkwell-pgdata
```

```bash
docker network rm inkwell
```

## Deployment

`.github/workflows/pipeline.yml` lints, tests and builds every pull request and push to `main`. On `main` it also pushes the runner image to GitHub Container Registry and deploys to Vercel production: it builds first, then runs `prisma migrate deploy`, and only deploys if every migration succeeded (`scripts/deploy.sh`).

**Serverless backend.** On Vercel there is no long-running server: every backend entry point (the REST route handlers under `/api/v1`, the tRPC endpoint, Better Auth's `/api/auth` handler, the server actions and server-rendered pages) runs as a serverless Vercel Function that scales with traffic. The same code also runs as one ordinary Node.js server in the Docker `runner` image.

It needs these secrets in the GitHub `production` environment: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and `DIRECT_DATABASE_URL` (a direct, non-pooled connection string for migrations). Set `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (your production URL) in the Vercel project's environment variables.

### CI/CD in action

Every push to `main` runs the full pipeline. [Run #8](https://github.com/zaidhamarneh/Inkwell/actions/runs/42119553772) (commit `62a2170`) is a typical example, finishing in 6m 58s:

1. **lint**, **unit** (tests with the coverage threshold) and **integration** (tests against a throwaway Postgres) run in parallel.
2. **build** starts only after all three pass, and builds and publishes the runtime image to GHCR.
3. **deploy** runs only after **build**: it applies the database migrations, then deploys to Vercel production.

![Pipeline run #8: lint, unit and integration pass, then build, then deploy](docs/images/pipeline-run.png)

The badge at the top of this README shows the current status of `main`. Every run, with its full logs, is listed on the [Actions page](https://github.com/zaidhamarneh/Inkwell/actions/workflows/pipeline.yml).

## Scripts

- `bun dev` — start the dev server (Turbopack)
- `bun run build` — production build
- `bun start` — serve the production build
- `bun run lint` — run Oxlint (`.oxlintrc.json`): type-aware, fails on any warning, and `any` is not allowed (explicit or inferred)
- `bun run db:migrate` — create and apply a Prisma migration
- `bun run db:generate` — regenerate the Prisma client (also runs on `bun install`)
- `bun run db:studio` — browse the database in Prisma Studio
- `bun run db:seed` — load demo data (`prisma/seed.ts`); safe to re-run
- `bun run test` — unit and React component tests (Jest, mocked, no database needed)
- `bun run test:coverage` — the same tests with a coverage report; fails below the thresholds in `jest.config.mjs` (CI runs this)
- `bun run test:integration` — integration tests against a separate `<db>_test` database

## Auth REST API

JSON endpoints under `/api/v1/auth`, built as Next.js Route Handlers (Node.js runtime) on top of Better Auth and Prisma. Request bodies are validated with the same Zod schemas the forms use (`src/shared/schemas/auth/auth.ts`). Sessions are stored in PostgreSQL and sent as an `HttpOnly`, `SameSite=Lax` cookie (`Secure` over HTTPS).

### Sessions

- **Sliding expiry.** A session lasts 7 days. While it's in use, its expiry is pushed back to "now + 7 days" (at most once a day), so active users stay signed in. `src/proxy.ts` does this on every page request and sends the refreshed cookie.
- **Immediate revocation.** Every session check reads the `session` table (no cookie cache), so logging out, revoking a session (e.g. Better Auth's `/api/auth/revoke-other-sessions`) or deleting its row makes that cookie useless on the very next request. Expired sessions are rejected and their cookies cleared.
- **Proxy gate.** `src/proxy.ts` checks the session for every request before it reaches the app:
  - protected pages (`PROTECTED_PAGE_PREFIXES`) redirect to `/login`;
  - every `/api` route except sign-in/up/out and Better Auth's (`PUBLIC_API_PREFIXES`) gets `401 UNAUTHORIZED`, including tRPC;
  - every server action (likes, comments) gets `401`, whatever path it's posted to (actions are recognised by their `Next-Action` header).
- **Second check in each handler.** Pages (`(protected)/layout.tsx`), route handlers, tRPC procedures and server actions still verify the session themselves and enforce ownership (only your post, only your comment), which the proxy can't know. Next.js recommends never relying on the proxy alone. Keep both when adding new endpoints.
- In the browser, call server actions through `callAction()` (`src/shared/actions/call-action.ts`): a proxy `401` makes the action throw, and `callAction` turns that into a normal error result.

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | `{ name, email, password, confirmPassword }` | `201 { data: { user } }` + session cookie |
| `POST` | `/api/v1/auth/login` | `{ email, password }` | `200 { data: { user } }` + session cookie |
| `POST` | `/api/v1/auth/logout` | none | `204`, cookies cleared (also when not signed in) |

`user` is `{ id, name, email, emailVerified, createdAt }`. Password hashes and session tokens are never returned in the body.

### Errors

Every error has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid.",
    "fieldErrors": { "confirmPassword": ["Passwords do not match"] }
  }
}
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | Body isn't valid JSON |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (same message for both, so emails can't be probed) |
| 401 | `UNAUTHORIZED` | The request needs a valid session |
| 403 | `FORBIDDEN` | Editing or deleting a post or comment that isn't yours |
| 404 | `NOT_FOUND` | The post or comment doesn't exist |
| 405 | — | Wrong HTTP method (handled by Next.js; no JSON body) |
| 409 | `EMAIL_TAKEN` | Registering an email that already has an account |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` isn't `application/json` |
| 422 | `VALIDATION_ERROR` | Schema validation failed; see `fieldErrors` |
| 429 | `RATE_LIMITED` | Too many attempts; see "Rate limits" below. Includes a `Retry-After` header (seconds) |
| 500 | `INTERNAL_ERROR` | Anything unexpected; details are logged on the server, never sent to the client |

Server actions return the same `{ code, message, fieldErrors? }` inside their result. tRPC errors use tRPC's own envelope (`error.message`, `error.data.code`, `error.data.fieldErrors`), never with a stack trace.

Text limits: name up to 100 characters, email up to 254, password 8–128. Better Auth's own `/api/auth/sign-up/email` and `/api/auth/sign-in/email` routes are disabled (`src/shared/auth/auth.ts`), so these endpoints are the only way to register or sign in.

### Example

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \
  -c cookies.txt \
  -d '{"name":"Ada","email":"ada@example.com","password":"longer123","confirmPassword":"longer123"}'
```

Code: route handlers in `src/app/api/v1/auth/*/route.ts`, shared helpers (body parsing, error mapping, response shapes) in `src/shared/api/`.

## Posts REST API

Creating, editing and deleting posts go through JSON endpoints under `/api/v1/posts`. They need a valid session cookie, use the same error format as the auth API, and validate bodies with `postSchema` (`src/shared/schemas/post/post.ts`). Comments and likes are server actions instead (`src/shared/actions/`).

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| `POST` | `/api/v1/posts` | `{ title, content }` | `201 { data: { post } }` |
| `PUT` | `/api/v1/posts/:postId` | `{ title, content }` (both required; replaces the post) | `200 { data: { post } }` |
| `DELETE` | `/api/v1/posts/:postId` | none | `204` (its comments and likes are deleted too) |

`post` is `{ id, title, content, authorId, createdAt, updatedAt }`. Title: 1–150 characters, content: 1–20,000, both trimmed.

### Ownership

Only the author can edit or delete a post or a comment. Every edit/delete path checks this through `src/shared/auth/ownership.ts` before writing:

- post `PUT`/`DELETE` → `403 FORBIDDEN` if it isn't yours, `404 NOT_FOUND` if it doesn't exist (ownership is checked before the body is validated);
- comment `editComment`/`deleteComment` server actions → the same `403`/`404` errors;
- the edit page shows "You can't edit this post" and never sends someone else's post content to the browser.

The repository writes also filter by `authorId`, so even a missed check can't change someone else's content. The Edit/Delete buttons only appear for the author, but that's a convenience, not the protection.

## Reading posts (tRPC)

Posts are read through tRPC (`/api/trpc`), not REST. The router lives in `src/shared/trpc/routers/` and calls the same repositories as everything else.

| Procedure | Input | Returns |
| --- | --- | --- |
| `posts.list` | `{ scope: "all" \| "mine", cursor? }` | `{ items: PostSummary[], nextCursor }`, 20 newest first |
| `posts.byId` | `{ postId }` | `PostDetail` or `null` |

Both require a signed-in user (`UNAUTHORIZED` otherwise). Dates come through as real `Date`s (superjson).

Pages prefetch on the server and hand the data to client components through React Query:

```tsx
// Server Component (page.tsx)
await getQueryClient().prefetchInfiniteQuery(
  trpc.posts.list.infiniteQueryOptions({ scope: "all" }, { getNextPageParam: (p) => p.nextCursor }),
);
return <HydrateClient><PostFeed scope="all" … /></HydrateClient>;

// Client Component
const trpc = useTRPC();
const { data } = useSuspenseInfiniteQuery(trpc.posts.list.infiniteQueryOptions(…));
```

After anything that changes posts (likes, comments, create/edit/delete), `PostsContext` invalidates the affected cached queries in the browser (`queryClient.invalidateQueries(trpc.posts.pathFilter())`).

## Data loading and streaming

Pages render their shell right away and stream data in behind `<Suspense>` skeletons (`src/shared/posts/skeletons.tsx`):

- **Promise + `use()`** for data that isn't in React Query. The server component starts the query without `await` and passes the promise to a client component, which reads it with `use()`:
  - comments on a post (`src/app/(protected)/posts/[postId]/components/comment-list.tsx`)
  - the post being edited (`src/app/(protected)/posts/[postId]/edit/components/edit-post-form.tsx`)
- **Streamed React Query prefetch** for tRPC data (dashboard, feed): the page calls `void prefetchInfiniteQuery(...)` without awaiting, and the client's `useSuspenseInfiniteQuery` suspends until the streamed result arrives. Same effect as `use()`, but the data stays in the React Query cache so "Load more" and post-change refetches keep working.
- **Awaited on purpose**: the session check in `(protected)/layout.tsx` (nothing renders before it passes) and whether a post exists on its page (decides "not found").

A failed promise or query shows `(protected)/error.tsx` with a "Try again" button.

## State management (Context API)

Client-side app state lives in two React contexts in `src/shared/state/`.

**`auth-context.tsx`: authentication**

- `AuthProvider` (root layout) → `useAuth()` returns `signIn`, `signUp` and `signOut`. Used by the login and register forms and the user menu. Each one calls the auth API, clears all cached data (so nothing from the previous user stays in memory) and navigates.
- `CurrentUserProvider` (protected layout) → `useCurrentUser()` returns `{ id, name, email }`. The user is loaded and verified on the server for every request, so the context never holds a stale or forged user. The session itself stays in an HttpOnly cookie.

**`posts-context.tsx`: blog post data**

- `PostsProvider` (protected layout) is the only way client components read or change posts:
  - reading: `usePostFeed("all" | "mine")`, `usePost(postId)`
  - changing: `usePosts()` returns `createPost`, `updatePost`, `deletePost`, `setLike`, `addComment`, `editComment` and `deleteComment`
- After each change, the context refreshes the affected post data, so the dashboard, feed and post page stay in sync. Fetched data is cached by React Query (through tRPC) underneath.

The server still enforces sign-in, ownership and rate limits on every request; the contexts only organise client state.

## Rate limits

Stored in Postgres (`rate_limit` table, fixed windows), so they hold across restarts and server instances. Emails are hashed before being used as keys.

| What | Limit | Key |
| --- | --- | --- |
| Login | 10 attempts / 15 min | per account (email), from any IP: the brute-force guard |
| Login | 30 attempts / 15 min | per IP, across all accounts |
| Register | 5 accounts / hour | per IP |
| Like / unlike | 20 changes / min | per user |

Why the auth routes need their own: `/api/v1/auth/*` call Better Auth server-side (`auth.api.*`), which skips Better Auth's own HTTP rate limiter (that one only covers `/api/auth/*`). Limits live in `src/shared/rate-limit/request-limits.ts`.

The per-IP limits read `X-Forwarded-For` / `X-Real-IP`, which are only trustworthy behind a proxy or CDN that sets them (e.g. Vercel). Without one, a client can fake its IP, but the per-account login limit still applies.

## Testing

Tests use **Jest** (`jest.config.mjs`, via `next/jest`) and live **next to the code they test**, in `__tests__` folders. Next.js ignores `_`-prefixed folders, so they never become routes:

```
src/shared/auth/ownership.ts
src/shared/auth/__tests__/ownership.test.ts
```

```bash
bun run test
```

**Unit tests** (`*.test.ts`) mock the database, the session and Better Auth. They cover every REST route, tRPC procedure and server action, including:

- **Signed out:** every route, tRPC procedure, server action and protected page rejects (401 or redirect), and the proxy blocks server actions on any path.
- **Not the author:** editing or deleting someone else's post or comment returns 403 (checked before the body is validated); a missing one returns 404.
- **Rate limits:** login per IP and per account, registration per IP, and likes per user return 429 with `Retry-After`, checked before any work is done.
- Validation messages, error formatting (no internal details leak), the API client and `applyApiError`.

```bash
bun run test:integration
```

**Integration tests** (`*.integration.test.ts`) run the repositories, ownership checks and the rate-limit SQL against a real **test** database: `DATABASE_URL` with `_test` appended (e.g. `inkwell_test`), or `TEST_DATABASE_URL` if set. It's created and migrated automatically and emptied before each test. The run refuses any database whose name doesn't end in `_test`, so your dev data is never touched. They cover pagination, cascade deletes, the `authorId` second guard, idempotent and concurrent likes, and the rate limiter's window reset and atomicity under concurrent requests.

**Component tests** (`*.test.tsx`, also run by `bun run test`) render React components in a simulated browser (jsdom + Testing Library) and use them like a user would. Each file starts with `/** @jest-environment jsdom */`.

- **`LikeButton`:** instant feedback, rapid clicks merged into one request after 400 ms, no request when clicks end where they started, one request at a time (a change made meanwhile is sent after), revert + message on a 429, and sending an unsent click when leaving the page.
- **`LoginForm` / `RegisterForm`:** browser-side validation, server errors placed under the right field ("email taken") or at the form level ("incorrect password"), the password mismatch clearing when *either* password is fixed, and the forms clearing after success.
- **`AuthContext`:** sign in/up/out call the right API, clear cached data and navigate; failures do neither.
- **`PostsContext`:** each change refreshes the right data (deleting a post refreshes only the lists), rejected changes refresh nothing, and a thrown action becomes an error result.
- **Delete dialogs (post and comment):** Cancel keeps the item, the dialog stays open while deleting and shows errors, and closes (or navigates to My feed) only on success.

Static, display-only components (navbar, cards, skeletons) and the shadcn UI components aren't tested; they have no logic of their own.

**Coverage.** `bun run test:coverage` measures all app code except the generated Prisma client and the shadcn UI primitives, and fails below 55% statements, 55% branches, 50% functions and 55% lines (`jest.config.mjs`). The CI `unit` job runs it. The repositories show as uncovered in that report because they're tested by the integration tests, which don't collect coverage.
