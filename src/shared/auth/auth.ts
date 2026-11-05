import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/shared/db/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  // Sign-up and sign-in go only through /api/v1/auth/*, which validate with
  // our Zod schemas and apply our rate limits. Disabling these HTTP routes
  // doesn't affect auth.api.signUpEmail / signInEmail, which those routes call.
  disabledPaths: ["/sign-up/email", "/sign-in/email"],
  session: {
    // Sliding sessions: a session lives for 7 days, and while it's in use the
    // expiry is pushed back to "now + 7 days" at most once per day. An active
    // user stays signed in; one who's gone 7 days has to log in again.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // No cookieCache on purpose: every session check reads the session row,
    // so logging out or revoking a session (deleting its row) takes effect on
    // the very next request instead of after a cache window.
    cookieCache: { enabled: false },
  },
  // nextCookies must stay last: it lets Server Actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
