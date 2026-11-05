import { Errors } from "@/shared/api/errors";
import { json, toPublicUser, withErrorHandling } from "@/shared/api/http";
import { auth } from "@/shared/auth/auth";

/**
 * GET /api/v1/auth/me
 * 200 → { data: { user, session: { expiresAt } } }
 * 401 UNAUTHORIZED when there is no valid session cookie.
 */
export const GET = withErrorHandling(async (request) => {
  const result = await auth.api.getSession({ headers: request.headers });
  if (!result) throw Errors.unauthorized();

  return json({
    user: toPublicUser(result.user),
    session: { expiresAt: result.session.expiresAt.toISOString() },
  });
});
