import { json, parseBody, toPublicUser, withErrorHandling } from "@/shared/api/http";
import { auth } from "@/shared/auth/auth";
import { loginSchema } from "@/shared/schemas/auth/auth";

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * 200 → { data: { user } } and a session cookie.
 * 401 INVALID_CREDENTIALS · 415 · 400 INVALID_JSON · 422 VALIDATION_ERROR
 */
export const POST = withErrorHandling(async (request) => {
  const { email, password } = await parseBody(request, loginSchema);

  const { user } = await auth.api.signInEmail({
    body: { email, password },
    headers: request.headers,
  });

  return json({ user: toPublicUser(user) });
});
