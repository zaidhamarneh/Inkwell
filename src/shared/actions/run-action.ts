import "server-only";

import { z } from "zod";

import { ApiError, Errors } from "@/shared/api/errors";
import { getServerSession } from "@/shared/auth/session";

import type { ActionResult } from "./types";

/**
 * Runs a server action body and turns any failure into an ActionResult.
 * Unexpected errors are logged and returned as a generic message, so
 * internal details never reach the browser.
 */
export async function runAction<T>(
  name: string,
  body: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await body() };
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : (console.error(`[action] ${name} failed:`, error), Errors.internal());

    return {
      ok: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.fieldErrors && { fieldErrors: apiError.fieldErrors }),
      },
    };
  }
}

/** The signed-in user for a server action, or throws UNAUTHORIZED. */
export async function requireActionUser() {
  const session = await getServerSession();
  if (!session) throw Errors.unauthorized();
  return session.user;
}

/** Validates server action input, throwing VALIDATION_ERROR on failure. */
export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const { formErrors, fieldErrors } = z.flattenError(result.error);
    throw Errors.validation({
      ...(fieldErrors as Record<string, string[]>),
      ...(formErrors.length > 0 && { _form: formErrors }),
    });
  }
  return result.data;
}

/** Ids arrive from the browser, so they're checked like any other input. */
export const idSchema = z.string().min(1).max(64);
