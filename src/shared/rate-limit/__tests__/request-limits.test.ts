import { consumeRateLimit } from "../rate-limit";
import {
  AUTH_LIMITS,
  getClientIp,
  limitLoginByEmail,
  limitLoginByIp,
  limitRegisterByIp,
} from "../request-limits";

jest.mock("../rate-limit", () => ({ consumeRateLimit: jest.fn() }));
const mockConsume = jest.mocked(consumeRateLimit);

const requestFrom = (headers: Record<string, string>) =>
  new Request("http://test.local/api/v1/auth/login", { method: "POST", headers });

describe("getClientIp", () => {
  it("uses the first X-Forwarded-For address", () => {
    expect(getClientIp(requestFrom({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  });

  it("falls back to X-Real-IP, then 'unknown'", () => {
    expect(getClientIp(requestFrom({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(getClientIp(requestFrom({}))).toBe("unknown");
  });
});

describe("auth rate limits", () => {
  beforeEach(() => {
    mockConsume.mockResolvedValue({ allowed: true, remaining: 1 });
  });

  it("limits login per IP (30 / 15 min)", async () => {
    await limitLoginByIp(requestFrom({ "x-forwarded-for": "203.0.113.5" }));
    expect(mockConsume).toHaveBeenCalledWith("login:ip:203.0.113.5", AUTH_LIMITS.loginPerIp);
    expect(AUTH_LIMITS.loginPerIp).toEqual({ limit: 30, windowSeconds: 900 });
  });

  it("limits login per account (10 / 15 min) with a hashed, case-insensitive key", async () => {
    await limitLoginByEmail("Ada@Example.com ");
    await limitLoginByEmail("ada@example.com");
    const [first, second] = mockConsume.mock.calls.map(([key]) => key);

    expect(first).toBe(second);
    expect(first).toMatch(/^login:email:[0-9a-f]{32}$/);
    expect(first).not.toContain("ada");
    expect(AUTH_LIMITS.loginPerEmail).toEqual({ limit: 10, windowSeconds: 900 });
  });

  it("limits registration per IP (5 / hour)", async () => {
    await limitRegisterByIp(requestFrom({ "x-forwarded-for": "203.0.113.9" }));
    expect(mockConsume).toHaveBeenCalledWith("register:ip:203.0.113.9", AUTH_LIMITS.registerPerIp);
    expect(AUTH_LIMITS.registerPerIp).toEqual({ limit: 5, windowSeconds: 3600 });
  });

  it("throws 429 with Retry-After seconds when over a limit", async () => {
    mockConsume.mockResolvedValue({ allowed: false, retryAfterSeconds: 125 });
    await expect(limitLoginByEmail("ada@example.com")).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      retryAfterSeconds: 125,
      message: "Too many login attempts for this account. Try again in 3 min.",
    });
    await expect(limitLoginByIp(requestFrom({}))).rejects.toMatchObject({ status: 429 });
    await expect(limitRegisterByIp(requestFrom({}))).rejects.toMatchObject({ status: 429 });
  });
});
