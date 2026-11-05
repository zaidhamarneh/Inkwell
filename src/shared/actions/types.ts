import type { ApiErrorBody } from "@/shared/api/types";

/**
 * What every server action returns. Errors use the same shape as the REST
 * API, so `applyApiError` can show them on a form.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody["error"] };
