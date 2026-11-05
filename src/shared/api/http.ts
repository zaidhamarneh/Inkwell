import "server-only";

import { isAPIError } from "better-auth/api";
import { z } from "zod";

import { auth } from "@/shared/auth/auth";

import { ApiError, Errors } from "./errors";
import type {
  ApiErrorBody,
  ApiPost,
  ApiSuccessBody,
  PublicUser,
} from "./types";

// Auth responses must never be cached by browsers or proxies.
const NO_STORE = { "Cache-Control": "no-store" };

export function json<T>(data: T, status = 200): Response {
  return Response.json({ data } satisfies ApiSuccessBody<T>, {
    status,
    headers: NO_STORE,
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: NO_STORE });
}

function errorResponse(error: ApiError): Response {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
    },
  };
  return Response.json(body, {
    status: error.status,
    headers: {
      ...NO_STORE,
      ...(error.retryAfterSeconds !== undefined && {
        "Retry-After": String(error.retryAfterSeconds),
      }),
    },
  });
}

/** Reads a JSON body and validates it, throwing an ApiError on failure. */
export async function parseBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw Errors.unsupportedMediaType();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw Errors.invalidJson();
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const { formErrors, fieldErrors } = z.flattenError(result.error);
    throw Errors.validation({
      ...(fieldErrors as Record<string, string[]>),
      ...(formErrors.length > 0 && { _form: formErrors }),
    });
  }
  return result.data;
}

/** Converts errors thrown by Better Auth into our API errors. */
function fromAuthError(error: unknown): ApiError | null {
  if (!isAPIError(error)) return null;

  const code = (error.body as { code?: string } | undefined)?.code ?? "";
  if (code.startsWith("USER_ALREADY_EXISTS")) return Errors.emailTaken();
  if (code === "INVALID_EMAIL_OR_PASSWORD") return Errors.invalidCredentials();
  if (error.statusCode === 401) return Errors.unauthorized();
  if (error.statusCode === 429) return Errors.rateLimited();
  if (error.statusCode === 400 || error.statusCode === 422) {
    return Errors.validation({ _form: [error.message] });
  }
  return null;
}

type Handler<TContext> = (
  request: Request,
  context: TContext,
) => Promise<Response>;

/**
 * Wraps a route handler so every failure becomes a consistent JSON error.
 * Unexpected errors are logged and returned as a generic 500, so internal
 * details (stack traces, SQL, connection strings) never reach the client.
 */
export function withErrorHandling<TContext = unknown>(
  handler: Handler<TContext>,
): Handler<TContext> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error);

      const authError = fromAuthError(error);
      if (authError) return errorResponse(authError);

      console.error(
        `[api] ${request.method} ${new URL(request.url).pathname} failed:`,
        error,
      );
      return errorResponse(Errors.internal());
    }
  };
}

/**
 * Returns the signed-in user for an API request, or throws 401.
 * Reads the session from the database every time (no cookie cache), so a
 * logged-out or revoked session is rejected immediately.
 */
export async function requireApiSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw Errors.unauthorized();
  return session;
}

export function toApiPost(post: {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}): ApiPost {
  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
