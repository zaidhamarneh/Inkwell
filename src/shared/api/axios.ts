import axios from "axios";

/**
 * Shared axios instance for calling Inkwell's own REST API from the browser.
 * Paths are relative to /api/v1, e.g. api.post("/auth/login", body).
 * Add interceptors here (e.g. redirect to /login on 401) when needed.
 */
export const api = axios.create({
  baseURL: "/api/v1",
  timeout: 15_000,
  withCredentials: true,
  headers: { Accept: "application/json" },
});
