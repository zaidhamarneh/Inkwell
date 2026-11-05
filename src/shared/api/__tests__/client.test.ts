import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";

import { api } from "../axios";
import { apiDelete, apiGet, apiPost, apiPut, applyApiError } from "../client";

jest.mock("../axios", () => ({ api: { request: jest.fn() } }));
const mockRequest = jest.mocked(api.request);

const response = (status: number, data: unknown): AxiosResponse =>
  ({ status, data, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } }) as AxiosResponse;

const httpError = (status: number, data: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, response(status, data));

describe("api client", () => {
  it("returns data on success and sends the right method/body", async () => {
    mockRequest.mockResolvedValue(response(200, { data: { id: 1 } }));
    await expect(apiPost("/posts", { a: 1 })).resolves.toEqual({ ok: true, data: { id: 1 } });
    expect(mockRequest).toHaveBeenLastCalledWith({ method: "POST", url: "/posts", data: { a: 1 } });

    await apiGet("/x");
    expect(mockRequest).toHaveBeenLastCalledWith({ method: "GET", url: "/x" });
    await apiPut("/posts/1", { b: 2 });
    expect(mockRequest).toHaveBeenLastCalledWith({ method: "PUT", url: "/posts/1", data: { b: 2 } });
  });

  it("treats 204 No Content as success with no data", async () => {
    mockRequest.mockResolvedValue(response(204, ""));
    await expect(apiDelete("/posts/1")).resolves.toEqual({ ok: true, data: undefined });
  });

  it("returns the API's error body for HTTP errors", async () => {
    const error = { code: "FORBIDDEN", message: "Not yours." };
    mockRequest.mockRejectedValue(httpError(403, { error }));
    await expect(apiDelete("/posts/1")).resolves.toEqual({ ok: false, status: 403, error });
  });

  it("uses a generic error when the body isn't in the API's format", async () => {
    mockRequest.mockRejectedValue(httpError(502, "<html>Bad gateway</html>"));
    await expect(apiGet("/x")).resolves.toMatchObject({
      ok: false,
      status: 502,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("reports timeouts and network failures", async () => {
    mockRequest.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    await expect(apiGet("/x")).resolves.toMatchObject({
      ok: false,
      status: 0,
      error: { message: expect.stringContaining("too long") as string },
    });

    mockRequest.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    await expect(apiGet("/x")).resolves.toMatchObject({
      error: { message: expect.stringContaining("Couldn't reach the server") as string },
    });
  });
});

describe("applyApiError", () => {
  it("puts field errors under matching fields, focusing the first", () => {
    const setError = jest.fn();
    applyApiError(
      { code: "VALIDATION_ERROR", message: "Some fields are invalid.", fieldErrors: { email: ["Taken"], password: ["Short"] } },
      setError,
      ["email", "password"],
    );
    expect(setError).toHaveBeenCalledWith("email", { message: "Taken" }, { shouldFocus: true });
    expect(setError).toHaveBeenCalledWith("password", { message: "Short" }, { shouldFocus: false });
    expect(setError).not.toHaveBeenCalledWith("root", expect.anything());
  });

  it("falls back to the root error for other errors", () => {
    const setError = jest.fn();
    applyApiError({ code: "INVALID_CREDENTIALS", message: "Incorrect email or password." }, setError, ["email"]);
    expect(setError).toHaveBeenCalledWith("root", { message: "Incorrect email or password." });
  });

  it("ignores field errors for fields the form doesn't have", () => {
    const setError = jest.fn();
    applyApiError(
      { code: "VALIDATION_ERROR", message: "Some fields are invalid.", fieldErrors: { _form: ["Bad"] } },
      setError,
      ["email"],
    );
    expect(setError).toHaveBeenCalledWith("root", { message: "Some fields are invalid." });
  });
});
