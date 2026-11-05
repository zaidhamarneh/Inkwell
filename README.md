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

Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Edit `src/app/page.tsx` and the page auto-updates.

## Scripts

- `bun dev` — start the dev server (Turbopack)
- `bun run build` — production build
- `bun start` — serve the production build
- `bun run lint` — run ESLint
- `bun run db:migrate` — create and apply a Prisma migration
- `bun run db:generate` — regenerate the Prisma client (also runs on `bun install`)
- `bun run db:studio` — browse the database in Prisma Studio

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
| 429 | `RATE_LIMITED` | Reserved. Rate limiting isn't enforced on these endpoints yet |
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

Only the author can update or delete a post. For anyone else the API answers `404 NOT_FOUND`, the same as for a post that doesn't exist, so it never reveals whether someone else's post exists.

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
