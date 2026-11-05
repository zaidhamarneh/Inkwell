import "server-only";

import { createHash } from "node:crypto";

import { Errors } from "@/shared/api/errors";

import { consumeRateLimit, type RateLimitRule } from "./rate-limit";

/**
 * Limits for the custom auth routes (/api/v1/auth/*). These call Better Auth
 * server-side (auth.api.*), which skips Better Auth's own HTTP rate limiter,
 * so the routes enforce their own.
 */
export const AUTH_LIMITS = {
  /** Login attempts from one IP, across all accounts. */
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  /** Login attempts against one account, from anywhere. The brute-force guard. */
  loginPerEmail: { limit: 10, windowSeconds: 15 * 60 },
  /** Accounts created from one IP. */
  registerPerIp: { limit: 5, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * The client's IP from the proxy headers, or "unknown".
 *
 * Only trustworthy behind a proxy/CDN that sets these headers itself (e.g.
 * Vercel); otherwise a client can send any value. That's why login also
 * limits per email, which can't be dodged by changing headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Hashes identifiers (emails) so the rate_limit table doesn't store them in plain text. */
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/** Counts one attempt for `key`; throws 429 RATE_LIMITED when over the rule. */
export async function enforceRateLimit(
  key: string,
  rule: RateLimitRule,
  message: (retryAfterSeconds: number) => string,
) {
  const result = await consumeRateLimit(key, rule);
  if (!result.allowed) {
    throw Errors.rateLimited(message(result.retryAfterSeconds), result.retryAfterSeconds);
  }
}

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

export async function limitLoginByIp(request: Request) {
  await enforceRateLimit(
    `login:ip:${getClientIp(request)}`,
    AUTH_LIMITS.loginPerIp,
    (s) => `Too many login attempts. Try again in ${minutes(s)} min.`,
  );
}

export async function limitLoginByEmail(email: string) {
  await enforceRateLimit(
    `login:email:${hash(email.trim().toLowerCase())}`,
    AUTH_LIMITS.loginPerEmail,
    (s) => `Too many login attempts for this account. Try again in ${minutes(s)} min.`,
  );
}

export async function limitRegisterByIp(request: Request) {
  await enforceRateLimit(
    `register:ip:${getClientIp(request)}`,
    AUTH_LIMITS.registerPerIp,
    (s) => `Too many accounts created from this network. Try again in ${minutes(s)} min.`,
  );
}
