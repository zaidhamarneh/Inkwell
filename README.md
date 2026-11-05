# Inkwell
blog posting website

Built with Next.js (App Router), React, TypeScript, Tailwind CSS and Bun.

## Getting Started

Install dependencies:

```bash
bun install
```

Set up the database: copy `.env.example` to `.env`, set `DATABASE_URL` to your PostgreSQL connection string and `BETTER_AUTH_SECRET` to a random value (`openssl rand -base64 32`), then apply migrations:

```bash
bun run db:migrate
```

Optionally, load demo data (3 users, 8 posts, comments and likes):

```bash
bun run db:seed
```

Sign in as any demo user with password `inkwell-demo-123`:

| User | Email |
| --- | --- |
| Ada Lovelace | `ada@example.com` |
| Grace Hopper | `grace@example.com` |
| Alan Turing | `alan@example.com` |

Re-running the seed resets only the demo users and their content; other accounts are left alone. These are local test credentials. Don't seed a production database.

Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Edit `src/app/page.tsx` and the page auto-updates.

## Scripts

- `bun dev` — start the dev server (Turbopack)
- `bun run build` — production build
- `bun start` — serve the production build
- `bun run lint` — run Oxlint (`.oxlintrc.json`): type-aware, fails on any warning, and `any` is not allowed (explicit or inferred)
- `bun run db:migrate` — create and apply a Prisma migration
- `bun run db:generate` — regenerate the Prisma client (also runs on `bun install`)
- `bun run db:studio` — browse the database in Prisma Studio
- `bun run db:seed` — load demo data (`prisma/seed.ts`); safe to re-run
- `bun run test` — unit tests (Jest, mocked, no database needed)
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

`user` is `{ id, name, email, emailVerified, image, createdAt }`. Password hashes and session tokens are never returned in the body.

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
| 405 | — | Wrong HTTP method (handled by Next.js) |
| 409 | `EMAIL_TAKEN` | Registering an email that already has an account |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` isn't `application/json` |
| 422 | `VALIDATION_ERROR` | Schema validation failed; see `fieldErrors` |
| 429 | `RATE_LIMITED` | Too many attempts; see "Rate limits" below. Includes a `Retry-After` header (seconds) |
| 500 | `INTERNAL_ERROR` | Anything unexpected; details are logged on the server, never sent to the client |

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

After anything that changes posts (likes, comments, create/edit/delete), invalidate the cached queries in the browser, e.g. `queryClient.invalidateQueries(trpc.posts.pathFilter())` or the `useInvalidatePosts()` hook.

## Data loading and streaming

Pages render their shell right away and stream data in behind `<Suspense>` skeletons (`src/shared/posts/skeletons.tsx`):

- **Promise + `use()`** for data that isn't in React Query. The server component starts the query without `await` and passes the promise to a client component, which reads it with `use()`:
  - comments on a post (`posts/[postId]/comment-list.tsx`)
  - the post being edited (`posts/[postId]/edit/edit-post-form.tsx`)
- **Streamed React Query prefetch** for tRPC data (dashboard, feed): the page calls `void prefetchInfiniteQuery(...)` without awaiting, and the client's `useSuspenseInfiniteQuery` suspends until the streamed result arrives. Same effect as `use()`, but the data stays in the React Query cache so "Load more" and post-change refetches keep working.
- **Awaited on purpose**: the session check in `(protected)/layout.tsx` (nothing renders before it passes) and whether a post exists on its page (decides "not found").

A failed promise or query shows `(protected)/error.tsx` with a "Try again" button.

## State management (Context API)

Client-side app state lives in two React contexts in `src/shared/state/`.

**`auth-context.tsx`: authentication**

- `AuthProvider` (root layout) → `useAuth()` returns `signIn`, `signUp` and `signOut`. Used by the login and register forms and the user menu. Each one calls the auth API, clears all cached data (so nothing from the previous user stays in memory) and navigates.
- `CurrentUserProvider` (protected layout) → `useCurrentUser()` returns `{ id, name, email, image }`. The user is loaded and verified on the server for every request, so the context never holds a stale or forged user. The session itself stays in an HttpOnly cookie.

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

**Unit tests** (`*.test.ts`, 144 tests) mock the database, the session and Better Auth, and cover every function and handler, including:

- **Signed out:** every route, tRPC procedure, server action and protected page rejects (401 or redirect), and the proxy blocks server actions on any path.
- **Not the author:** editing or deleting someone else's post or comment returns 403 (checked before the body is validated); a missing one returns 404.
- **Rate limits:** login per IP and per account, registration per IP, and likes per user return 429 with `Retry-After`, checked before any work is done.
- Validation messages, error formatting (no internal details leak), the API client and `applyApiError`.

```bash
bun run test:integration
```

**Integration tests** (`*.integration.test.ts`, 24 tests) run the repositories, ownership checks and the rate-limit SQL against a real **test** database: `DATABASE_URL` with `_test` appended (e.g. `inkwell_test`), or `TEST_DATABASE_URL` if set. It's created and migrated automatically and emptied before each test. The run refuses any database whose name doesn't end in `_test`, so your dev data is never touched. They cover pagination, cascade deletes, the `authorId` second guard, idempotent and concurrent likes, and the rate limiter's window reset and atomicity under concurrent requests.

Not covered yet: React components and hooks (forms, like button, contexts). Those need a browser-like test environment (jsdom + Testing Library).
