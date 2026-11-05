import { json, parseBody, toPublicUser, withErrorHandling } from "@/shared/api/http";
import { auth } from "@/shared/auth/auth";
import { limitRegisterByIp } from "@/shared/rate-limit/request-limits";
import { registerSchema } from "@/shared/schemas/auth/auth";

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, confirmPassword }
 * 201 → { data: { user } } and a session cookie (the user is signed in).
 * 409 EMAIL_TAKEN · 429 RATE_LIMITED (+ Retry-After)
 * 415 · 400 INVALID_JSON · 422 VALIDATION_ERROR
 *
 * Rate limited per IP (src/shared/rate-limit/request-limits.ts), because
 * auth.api.* calls skip Better Auth's own HTTP rate limiter.
 */
export const POST = withErrorHandling(async (request) => {
  await limitRegisterByIp(request);
  const { name, email, password } = await parseBody(request, registerSchema);

  const { user } = await auth.api.signUpEmail({
    body: { name, email, password },
    headers: request.headers,
  });

  return json({ user: toPublicUser(user) }, 201);
});
