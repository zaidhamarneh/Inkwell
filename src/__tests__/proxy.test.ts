import { NextRequest } from "next/server";

import { auth } from "@/shared/auth/auth";

import { config, proxy } from "../proxy";

jest.mock("@/shared/auth/auth", () => ({ auth: { api: { getSession: jest.fn() } } }));
const mockGetSession = jest.mocked(auth.api.getSession);

const SESSION_COOKIE = "better-auth.session_token=token.signature";

function request(
  path: string,
  { method = "GET", cookie = false, action = false }: { method?: string; cookie?: boolean; action?: boolean } = {},
) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", SESSION_COOKIE);
  if (action) headers.set("next-action", "abc123");
  return new NextRequest(`http://localhost:3000${path}`, { method, headers });
}

/** Mocks getSession({ returnHeaders: true }) → { headers, response }. */
function sessionIs(valid: boolean, setCookie?: string) {
  const headers = new Headers();
  if (setCookie) headers.append("set-cookie", setCookie);
  mockGetSession.mockResolvedValue({
    headers,
    response: valid ? { user: { id: "u1" }, session: {} } : null,
  } as never);
}

const isPassThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";
const redirectTarget = (res: Response) => res.headers.get("location");

describe("proxy: signed out (no session cookie)", () => {
  it("lets public pages through without a database lookup", async () => {
    const res = await proxy(request("/login"));
    expect(isPassThrough(res)).toBe(true);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it.each(["/dashboard", "/feed", "/posts/abc", "/posts/abc/edit"])(
    "redirects protected page %s to /login",
    async (path) => {
      const res = await proxy(request(path));
      expect(res.status).toBe(307);
      expect(redirectTarget(res)).toBe("http://localhost:3000/login");
    },
  );

  it.each([
    ["GET", "/api/trpc/posts.list"],
    ["POST", "/api/v1/posts"],
    ["PUT", "/api/v1/posts/abc"],
    ["DELETE", "/api/v1/posts/abc"],
  ])("rejects %s %s with 401 JSON", async (method, path) => {
    const res = await proxy(request(path, { method }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "You need to be logged in." },
    });
  });

  it("lets the public auth APIs through", async () => {
    for (const path of ["/api/v1/auth/login", "/api/v1/auth/register", "/api/auth/get-session"]) {
      expect(isPassThrough(await proxy(request(path, { method: "POST" })))).toBe(true);
    }
  });

  it("rejects server actions (likes, comments) on ANY path, even public ones", async () => {
    for (const path of ["/login", "/", "/dashboard"]) {
      const res = await proxy(request(path, { method: "POST", action: true }));
      expect(res.status).toBe(401);
    }
  });
});

describe("proxy: with a session cookie", () => {
  it("lets valid sessions through and forwards a refreshed cookie", async () => {
    sessionIs(true, "better-auth.session_token=new; Max-Age=604800");
    const res = await proxy(request("/dashboard", { cookie: true }));
    expect(isPassThrough(res)).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=604800");
  });

  it("allows server actions and protected APIs for a valid session", async () => {
    sessionIs(true);
    expect(isPassThrough(await proxy(request("/dashboard", { method: "POST", cookie: true, action: true })))).toBe(true);
    expect(isPassThrough(await proxy(request("/api/v1/posts", { method: "POST", cookie: true })))).toBe(true);
  });

  it("treats a revoked/expired session as signed out and clears its cookie", async () => {
    sessionIs(false, "better-auth.session_token=; Max-Age=0");

    const page = await proxy(request("/feed", { cookie: true }));
    expect(redirectTarget(page)).toBe("http://localhost:3000/login");
    expect(page.headers.get("set-cookie")).toContain("Max-Age=0");

    sessionIs(false);
    expect((await proxy(request("/api/trpc/posts.list", { cookie: true }))).status).toBe(401);
    sessionIs(false);
    expect((await proxy(request("/login", { method: "POST", cookie: true, action: true }))).status).toBe(401);
  });

  it("fails open to the handlers (which re-check) if the session lookup errors", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGetSession.mockRejectedValue(new Error("db down"));
    expect(isPassThrough(await proxy(request("/dashboard", { cookie: true })))).toBe(true);
    spy.mockRestore();
  });
});

describe("proxy matcher", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it("covers pages and APIs, including tRPC paths with dots", () => {
    for (const path of ["/dashboard", "/api/v1/posts", "/api/trpc/posts.list", "/login"]) {
      expect(matcher.test(path)).toBe(true);
    }
  });

  it("skips build assets and static files", () => {
    for (const path of ["/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/next.svg", "/logo.png"]) {
      expect(matcher.test(path)).toBe(false);
    }
  });
});
