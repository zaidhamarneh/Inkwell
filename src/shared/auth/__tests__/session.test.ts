import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "../auth";
import { getServerSession, requireSession } from "../session";

jest.mock("../auth", () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock("next/headers", () => ({ headers: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const mockGetSession = jest.mocked(auth.api.getSession);
const session = { user: { id: "u1", name: "Ada" }, session: { id: "s1" } };

beforeEach(() => {
  jest.mocked(headers).mockResolvedValue(new Headers({ cookie: "x=1" }) as never);
});

describe("getServerSession", () => {
  it("reads the session from the database without refreshing it", async () => {
    mockGetSession.mockResolvedValue(session as never);
    await expect(getServerSession()).resolves.toBe(session);
    expect(mockGetSession).toHaveBeenCalledWith({
      headers: expect.any(Headers) as Headers,
      query: { disableRefresh: true },
    });
  });
});

describe("requireSession", () => {
  it("returns the session when signed in", async () => {
    mockGetSession.mockResolvedValue(session as never);
    await expect(requireSession()).resolves.toBe(session);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /login when not signed in", async () => {
    mockGetSession.mockResolvedValue(null as never);
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
