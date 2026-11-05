import { noContent, withErrorHandling } from "@/shared/api/http";
import { auth } from "@/shared/auth/auth";

/**
 * POST /api/v1/auth/logout
 * 204 → session revoked (if any) and auth cookies cleared.
 * Idempotent: also 204 when there is no active session.
 */
export const POST = withErrorHandling(async (request) => {
  await auth.api.signOut({ headers: request.headers });
  return noContent();
});
