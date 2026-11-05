import { z } from "zod";

import { ApiError, Errors } from "../errors";
import {
  json,
  noContent,
  parseBody,
  toApiPost,
  toPublicUser,
  withErrorHandling,
} from "../http";

// http.ts imports the Better Auth instance (for requireApiSession); keep the
// real database and config out of unit tests.
jest.mock("@/shared/auth/auth", () => ({ auth: { api: { getSession: jest.fn() } } }));

const jsonRequest = (body: unknown, contentType = "application/json") =>
  new Request("http://test.local/api", {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const schema = z.object({ title: z.string().min(1, "Enter a title") });

describe("json / noContent", () => {
  it("wraps data and disables caching", async () => {
    const res = json({ ok: 1 }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: { ok: 1 } });
  });

  it("returns an empty 204", async () => {
    const res = noContent();
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
});

describe("parseBody", () => {
  it("returns validated data", async () => {
    await expect(parseBody(jsonRequest({ title: "Hi" }), schema)).resolves.toEqual({
      title: "Hi",
    });
  });

  it("rejects a non-JSON content type with 415", async () => {
    await expect(parseBody(jsonRequest("x", "text/plain"), schema)).rejects.toMatchObject({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  it("rejects malformed JSON with 400", async () => {
    await expect(parseBody(jsonRequest("{not json"), schema)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_JSON",
    });
  });

  it("rejects invalid fields with 422 and per-field messages", async () => {
    await expect(parseBody(jsonRequest({ title: "" }), schema)).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      fieldErrors: { title: ["Enter a title"] },
    });
  });
});

describe("withErrorHandling", () => {
  const request = new Request("http://test.local/api/x");

  it("passes successful responses through", async () => {
    const handler = withErrorHandling(() => Promise.resolve(json({ fine: true })));
    const res = await handler(request, undefined);
    expect(res.status).toBe(200);
  });

  it("turns an ApiError into its status and error body", async () => {
    const handler = withErrorHandling(() => Promise.reject(Errors.forbidden("Nope.")));
    const res = await handler(request, undefined);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "FORBIDDEN", message: "Nope." } });
  });

  it("adds Retry-After to rate-limit errors", async () => {
    const handler = withErrorHandling(() =>
      Promise.reject(Errors.rateLimited("Slow down.", 42)),
    );
    const res = await handler(request, undefined);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandling(() =>
      Promise.reject(new Error("connect ECONNREFUSED postgres://secret")),
    );
    const res = await handler(request, undefined);
    const body = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("maps Better Auth's invalid-credentials error to 401 INVALID_CREDENTIALS", async () => {
    const { APIError } = await import("better-auth/api");
    const handler = withErrorHandling(() =>
      Promise.reject(
        new APIError("UNAUTHORIZED", {
          code: "INVALID_EMAIL_OR_PASSWORD",
          message: "Invalid email or password",
        }),
      ),
    );
    const res = await handler(request, undefined);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
  });

  it("maps Better Auth's user-exists error to 409 EMAIL_TAKEN", async () => {
    const { APIError } = await import("better-auth/api");
    const handler = withErrorHandling(() =>
      Promise.reject(
        new APIError("UNPROCESSABLE_ENTITY", {
          code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
          message: "User already exists.",
        }),
      ),
    );
    const res = await handler(request, undefined);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: { code: "EMAIL_TAKEN", fieldErrors: { email: [expect.any(String)] } },
    });
  });
});

describe("toApiPost / toPublicUser", () => {
  const date = new Date("2026-01-02T03:04:05.000Z");

  it("serialises post dates as ISO strings", () => {
    expect(
      toApiPost({ id: "p", title: "t", content: "c", authorId: "u", createdAt: date, updatedAt: date }),
    ).toEqual({
      id: "p",
      title: "t",
      content: "c",
      authorId: "u",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-02T03:04:05.000Z",
    });
  });

  it("returns only public user fields", () => {
    const user = {
      id: "u",
      name: "Ada",
      email: "ada@example.com",
      emailVerified: true,
      image: "https://example.com/ada.png",
      createdAt: date,
      passwordHash: "should-not-leak",
    };
    expect(toPublicUser(user)).toEqual({
      id: "u",
      name: "Ada",
      email: "ada@example.com",
      emailVerified: true,
      createdAt: "2026-01-02T03:04:05.000Z",
    });
  });
});

describe("ApiError", () => {
  it("keeps status, code and field errors", () => {
    const error = new ApiError(422, "VALIDATION_ERROR", "Bad", { a: ["x"] });
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ status: 422, code: "VALIDATION_ERROR", fieldErrors: { a: ["x"] } });
  });
});
