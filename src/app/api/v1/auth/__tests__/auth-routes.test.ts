import { APIError } from "better-auth/api";

import { auth } from "@/shared/auth/auth";
import { consumeRateLimit } from "@/shared/rate-limit/rate-limit";

import { POST as login } from "../login/route";
import { POST as logout } from "../logout/route";
import { POST as register } from "../register/route";

jest.mock("@/shared/auth/auth", () => ({
  auth: { api: { signInEmail: jest.fn(), signUpEmail: jest.fn(), signOut: jest.fn() } },
}));
// The real request-limits logic runs; only the counter is mocked.
jest.mock("@/shared/rate-limit/rate-limit", () => ({ consumeRateLimit: jest.fn() }));

const mockConsume = jest.mocked(consumeRateLimit);
const user = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const post = (path: string, body: unknown, ip = "203.0.113.5") =>
  new Request(`http://test.local/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mockConsume.mockResolvedValue({ allowed: true, remaining: 1 });
});

describe("POST /api/v1/auth/login", () => {
  const credentials = { email: "ada@example.com", password: "longer123" };

  it("signs in and returns the public user", async () => {
    jest.mocked(auth.api.signInEmail).mockResolvedValue({ user } as never);
    const res = await login(post("login", credentials), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { user: expect.objectContaining({ id: "u1", email: "ada@example.com" }) as unknown },
    });
  });

  it("maps a wrong password to 401 INVALID_CREDENTIALS", async () => {
    jest
      .mocked(auth.api.signInEmail)
      .mockRejectedValue(
        new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" }),
      );
    const res = await login(post("login", credentials), undefined);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
  });

  it("validates the body (422)", async () => {
    const res = await login(post("login", { email: "bad" }), undefined);
    expect(res.status).toBe(422);
    expect(auth.api.signInEmail).not.toHaveBeenCalled();
  });

  it("is rate limited per IP, checked first (even malformed requests count)", async () => {
    mockConsume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 300 });
    const res = await login(post("login", { email: "bad" }, "198.51.100.1"), undefined);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("300");
    expect(mockConsume).toHaveBeenCalledWith("login:ip:198.51.100.1", expect.anything());
    expect(auth.api.signInEmail).not.toHaveBeenCalled();
  });

  it("is rate limited per account, whatever the IP", async () => {
    mockConsume
      .mockResolvedValueOnce({ allowed: true, remaining: 29 }) // IP ok
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 600 }); // account limited
    const res = await login(post("login", credentials, "198.51.100.2"), undefined);

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      error: { code: "RATE_LIMITED", message: expect.stringContaining("this account") as string },
    });
    expect(mockConsume.mock.calls[1]?.[0]).toMatch(/^login:email:/);
    expect(auth.api.signInEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/auth/register", () => {
  const body = {
    name: "Ada",
    email: "ada@example.com",
    password: "longer123",
    confirmPassword: "longer123",
  };

  it("creates the account (201)", async () => {
    jest.mocked(auth.api.signUpEmail).mockResolvedValue({ user } as never);
    const res = await register(post("register", body), undefined);
    expect(res.status).toBe(201);
    // confirmPassword is only validated, never sent to Better Auth.
    expect(auth.api.signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { name: "Ada", email: "ada@example.com", password: "longer123" },
      }),
    );
  });

  it("rejects mismatched passwords (422)", async () => {
    const res = await register(post("register", { ...body, confirmPassword: "other1234" }), undefined);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: { fieldErrors: { confirmPassword: ["Passwords do not match"] } },
    });
  });

  it("maps an existing email to 409 EMAIL_TAKEN", async () => {
    jest
      .mocked(auth.api.signUpEmail)
      .mockRejectedValue(
        new APIError("UNPROCESSABLE_ENTITY", {
          code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
          message: "exists",
        }),
      );
    const res = await register(post("register", body), undefined);
    expect(res.status).toBe(409);
  });

  it("is rate limited per IP (429)", async () => {
    mockConsume.mockResolvedValue({ allowed: false, retryAfterSeconds: 3600 });
    const res = await register(post("register", body, "198.51.100.3"), undefined);
    expect(res.status).toBe(429);
    expect(mockConsume).toHaveBeenCalledWith("register:ip:198.51.100.3", expect.anything());
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("signs out with 204", async () => {
    jest.mocked(auth.api.signOut).mockResolvedValue({ success: true } as never);
    const res = await logout(post("logout", {}), undefined);
    expect(res.status).toBe(204);
  });
});
