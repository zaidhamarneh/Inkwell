import "server-only";

import type { ApiErrorCode } from "./types";

/** An error that maps directly to an HTTP error response. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const Errors = {
  invalidJson: () =>
    new ApiError(400, "INVALID_JSON", "Request body must be valid JSON."),
  unsupportedMediaType: () =>
    new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json.",
    ),
  validation: (fieldErrors: Record<string, string[]>) =>
    new ApiError(
      422,
      "VALIDATION_ERROR",
      "Some fields are invalid.",
      fieldErrors,
    ),
  emailTaken: () =>
    new ApiError(
      409,
      "EMAIL_TAKEN",
      "An account with this email already exists.",
      { email: ["An account with this email already exists."] },
    ),
  invalidCredentials: () =>
    new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password."),
  unauthorized: () =>
    new ApiError(401, "UNAUTHORIZED", "You need to be logged in."),
  rateLimited: () =>
    new ApiError(429, "RATE_LIMITED", "Too many requests. Try again later."),
  internal: () =>
    new ApiError(500, "INTERNAL_ERROR", "Something went wrong on our end."),
};
