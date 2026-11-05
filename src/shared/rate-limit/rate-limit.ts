import "server-only";

import { prisma } from "@/shared/db/db";

export type RateLimitRule = {
  /** How many actions are allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Counts one action for `key` and says whether it's within `rule`.
 *
 * Fixed window, stored in Postgres (table `rate_limit`) so the limit holds
 * across server restarts and multiple instances. The insert-or-increment is
 * a single atomic statement, so concurrent requests can't both slip under
 * the limit.
 */
export async function consumeRateLimit(
  key: string,
  { limit, windowSeconds }: RateLimitRule,
): Promise<RateLimitResult> {
  // retryAfter is worked out by Postgres from its own clock, so app/database
  // time zone or clock differences can't skew it.
  const [row] = await prisma.$queryRaw<{ count: number; retryAfter: number }[]>`
    INSERT INTO "rate_limit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit"."windowStart" <= now() - make_interval(secs => ${windowSeconds}::int)
        THEN 1
        ELSE "rate_limit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "rate_limit"."windowStart" <= now() - make_interval(secs => ${windowSeconds}::int)
        THEN now()
        ELSE "rate_limit"."windowStart"
      END
    RETURNING
      "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
        "windowStart" + make_interval(secs => ${windowSeconds}::int) - now()
      ))))::int AS "retryAfter"
  `;

  if (row.count <= limit) {
    return { allowed: true, remaining: limit - row.count };
  }
  return { allowed: false, retryAfterSeconds: row.retryAfter };
}
