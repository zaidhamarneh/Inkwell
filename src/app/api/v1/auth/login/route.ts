import { json, parseBody, toPublicUser, withErrorHandling } from "@/shared/api/http";
import { auth } from "@/shared/auth/auth";
import { limitLoginByEmail, limitLoginByIp } from "@/shared/rate-limit/request-limits";
import { loginSchema } from "@/shared/schemas/auth/auth";

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * 200 → { data: { user } } and a session cookie.
 * 401 INVALID_CREDENTIALS · 429 RATE_LIMITED (+ Retry-After)
 * 415 · 400 INVALID_JSON · 422 VALIDATION_ERROR
 *
 * Rate limited per IP and per email (src/shared/rate-limit/request-limits.ts),
 * because auth.api.* calls skip Better Auth's own HTTP rate limiter.
 */
export const POST = withErrorHandling(async (request) => {
  // Per IP first, so even malformed requests count.
  await limitLoginByIp(request);
  const { email, password } = await parseBody(request, loginSchema);
  // Per account, whatever IP the attempts come from.
  await limitLoginByEmail(email);

  const { user } = await auth.api.signInEmail({
    body: { email, password },
    headers: request.headers,
  });

  return json({ user: toPublicUser(user) });
});
