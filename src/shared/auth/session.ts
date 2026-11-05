import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "./auth";

/**
 * Current session for Server Components, read straight from the database
 * (no cookie cache), so a logged-out or revoked session is null right away.
 *
 * Refresh is disabled here because Server Components can't set cookies;
 * src/proxy.ts refreshes the session on each page request instead.
 */
export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
}

/** Like getServerSession, but redirects to /login when there's no session. */
export async function requireSession() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session;
}
