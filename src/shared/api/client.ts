// Browser-side helpers for calling the REST API through the shared axios
// instance. They never throw: HTTP errors, timeouts and network failures all
// come back as { ok: false, error } in the API's error shape.

import { isAxiosError, type AxiosRequestConfig } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { api } from "./axios";
import type { ApiErrorBody, ApiSuccessBody } from "./types";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ApiErrorBody["error"] };

function failure(status: number, message: string): ApiResult<never> {
  return { ok: false, status, error: { code: "INTERNAL_ERROR", message } };
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorBody).error?.message === "string"
  );
}

async function request<T>(config: AxiosRequestConfig): Promise<ApiResult<T>> {
  try {
    const response = await api.request<ApiSuccessBody<T> | "">(config);
    // 204 No Content has an empty body.
    const data = response.data === "" ? undefined : response.data?.data;
    return { ok: true, data: data as T };
  } catch (error) {
    if (!isAxiosError(error)) {
      return failure(0, "Something went wrong. Please try again.");
    }
    if (error.response) {
      const { status, data } = error.response;
      return isApiErrorBody(data)
        ? { ok: false, status, error: data.error }
        : failure(status, "Something went wrong. Please try again.");
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return failure(0, "The server took too long to respond. Please try again.");
    }
    return failure(0, "Couldn't reach the server. Check your connection and try again.");
  }
}

/** GET a path under /api/v1, e.g. apiGet("/auth/me"). */
export function apiGet<T>(path: string): Promise<ApiResult<T>> {
  return request<T>({ method: "GET", url: path });
}

/** POST a JSON body to a path under /api/v1, e.g. apiPost("/auth/login", values). */
export function apiPost<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>({ method: "POST", url: path, data: body });
}

/**
 * Shows an API error on a React Hook Form form: field errors go under their
 * inputs, anything else goes to the form's "root" error.
 */
export function applyApiError<T extends FieldValues>(
  error: ApiErrorBody["error"],
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
) {
  let focused = false;
  for (const [name, messages] of Object.entries(error.fieldErrors ?? {})) {
    if ((fields as readonly string[]).includes(name) && messages[0]) {
      setError(name as Path<T>, { message: messages[0] }, { shouldFocus: !focused });
      focused = true;
    }
  }
  if (!focused) {
    setError("root", { message: error.message });
  }
}
