import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import type { ApiErrorBody } from "@/shared/api/types";
import { auth } from "@/shared/auth/auth";

/**
 * First line of auth for every request: pages, the REST and tRPC APIs, and
 * every server action (likes, comments, …).
 *
 * This is the *gate*, not the only check. Route handlers, tRPC procedures
 * and server actions still verify the session themselves and enforce
 * ownership (only your comment, only your post), which the proxy can't know.
 * Next.js recommends exactly this: a matcher change or a moved action must
 * never silently leave something unprotected.
 */

// Pages that need a signed-in user. (protected)/layout.tsx re-checks too.
const PROTECTED_PAGE_PREFIXES = ["/dashboard", "/feed", "/posts"];

// API routes anyone may call: sign-in/up/out and Better Auth's own endpoints.
// Every other /api route requires a session.
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/v1/auth/"];

const hasPrefix = (pathname: string, prefixes: string[]) =>
  prefixes.some(
    (prefix) =>
      pathname === prefix.replace(/\/$/, "") ||
      pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
  );

type Kind = "public" | "protected-page" | "protected-api" | "server-action";

function classify(request: NextRequest): Kind {
  const { pathname } = request.nextUrl;

  // Server actions are POSTs with a Next-Action header and can target ANY
  // path (even /login), so they're recognised by the header, not the URL.
  // Every server action in this app needs a signed-in user.
  if (request.method === "POST" && request.headers.has("next-action")) {
    return "server-action";
  }
  if (pathname.startsWith("/api/")) {
    return hasPrefix(pathname, PUBLIC_API_PREFIXES) ? "public" : "protected-api";
  }
  return hasPrefix(pathname, PROTECTED_PAGE_PREFIXES) ? "protected-page" : "public";
}

export async function proxy(request: NextRequest) {
  const kind = classify(request);

  // Public and no cookie: nothing to check or refresh.
  if (kind === "public" && !getSessionCookie(request)) {
    return NextResponse.next();
  }

  // No session cookie at all: reject without touching the database.
  if (!getSessionCookie(request)) {
    return reject(request, kind);
  }

  try {
    // Reads the session row (no cookie cache), so logged-out, expired or
    // revoked sessions are rejected immediately. Also refreshes the expiry.
    const { headers, response: session } = await auth.api.getSession({
      headers: request.headers,
      returnHeaders: true,
    });

    const response =
      session || kind === "public" ? NextResponse.next() : reject(request, kind);

    // Refreshed session cookie, or cleared cookies for a dead session.
    for (const cookie of headers.getSetCookie()) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    // e.g. database unreachable. Let it through: the page, route handler or
    // action checks the session itself and fails closed.
    console.error("[proxy] session check failed:", error);
    return NextResponse.next();
  }
}

function reject(request: NextRequest, kind: Kind) {
  if (kind === "protected-page" || kind === "public") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // API routes and server actions get a 401 in the API's error format.
  const body: ApiErrorBody = {
    error: { code: "UNAUTHORIZED", message: "You need to be logged in." },
  };
  return NextResponse.json(body, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}

export const config = {
  // Everything except Next.js build assets and static files. API routes are
  // included now. (Static files are matched by extension: tRPC paths such as
  // /api/trpc/posts.list contain dots too.)
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest|woff2?|map)$).*)",
  ],
};
