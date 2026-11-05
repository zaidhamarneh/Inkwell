import { json, parseBody, toPublicUser, withErrorHandling } from "@/shared/api/http";
import { auth } from "@/shared/auth/auth";
import { registerSchema } from "@/shared/schemas/auth/auth";

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, confirmPassword }
 * 201 → { data: { user } } and a session cookie (the user is signed in).
 * 409 EMAIL_TAKEN · 415 · 400 INVALID_JSON · 422 VALIDATION_ERROR
 */
export const POST = withErrorHandling(async (request) => {
  const { name, email, password } = await parseBody(request, registerSchema);

  const { user } = await auth.api.signUpEmail({
    body: { name, email, password },
    headers: request.headers,
  });

  return json({ user: toPublicUser(user) }, 201);
});
