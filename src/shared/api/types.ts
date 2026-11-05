// Response shapes for the REST API. Safe to import from the browser.

export type ApiErrorCode =
  | "INVALID_JSON"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "VALIDATION_ERROR"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Per-field messages, present when code is VALIDATION_ERROR. */
    fieldErrors?: Record<string, string[]>;
  };
};

export type ApiSuccessBody<T> = { data: T };

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
};

export type AuthUserResponse = ApiSuccessBody<{ user: PublicUser }>;

export type ApiPost = {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
};

export type PostResponse = ApiSuccessBody<{ post: ApiPost }>;
