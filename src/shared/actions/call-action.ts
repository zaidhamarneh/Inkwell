import type { ActionResult } from "./types";

/**
 * Calls a server action from the browser and always resolves to an
 * ActionResult. A server action normally returns its own errors, but it
 * throws when the request never reaches it: no connection, or the proxy
 * rejected it because the session ended (it answers 401, which Next.js
 * can't read as an action response).
 */
export async function callAction<T>(
  run: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message:
          "That didn't go through. You may have been signed out or lost connection. Refresh the page and try again.",
      },
    };
  }
}
