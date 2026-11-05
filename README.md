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
- **Protected pages.** Pages in `src/app/(protected)` redirect to `/login` without a valid session: first in `src/proxy.ts` (add new protected paths to `PROTECTED_PREFIXES`), then again in `(protected)/layout.tsx`, which always runs.

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
