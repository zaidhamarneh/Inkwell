import { getServerSession } from "@/shared/auth/session";
import { consumeRateLimit } from "@/shared/rate-limit/rate-limit";
import { setLike } from "@/shared/repositories/like-repository";

import { setPostLike } from "../like-actions";

jest.mock("@/shared/auth/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/shared/rate-limit/rate-limit", () => ({ consumeRateLimit: jest.fn() }));
jest.mock("@/shared/repositories/like-repository", () => ({ setLike: jest.fn() }));

const signInAs = (id: string | null) =>
  jest.mocked(getServerSession).mockResolvedValue((id ? { user: { id } } : null) as never);

beforeEach(() => {
  jest.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, remaining: 19 });
});

describe("setPostLike", () => {
  it("rejects signed-out users without counting or saving", async () => {
    signInAs(null);
    await expect(setPostLike("p1", true)).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(setLike).not.toHaveBeenCalled();
  });

  it("validates the input", async () => {
    signInAs("ben");
    await expect(setPostLike("", true)).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    await expect(setPostLike("p1", "yes" as unknown as boolean)).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("counts against a per-user limit of 20 per minute", async () => {
    signInAs("ben");
    jest.mocked(setLike).mockResolvedValue({ status: "ok", liked: true, likeCount: 1 });
    await setPostLike("p1", true);
    expect(consumeRateLimit).toHaveBeenCalledWith("like:ben", { limit: 20, windowSeconds: 60 });
  });

  it("rejects with 429 when the limit is reached, without saving", async () => {
    signInAs("ben");
    jest.mocked(consumeRateLimit).mockResolvedValue({ allowed: false, retryAfterSeconds: 37 });
    await expect(setPostLike("p1", true)).resolves.toEqual({
      ok: false,
      error: { code: "RATE_LIMITED", message: "You're liking too fast. Try again in 37s." },
    });
    expect(setLike).not.toHaveBeenCalled();
  });

  it("returns 404 when the post doesn't exist", async () => {
    signInAs("ben");
    jest.mocked(setLike).mockResolvedValue({ status: "not_found" });
    await expect(setPostLike("missing", true)).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("likes and unlikes (desired state, not a toggle)", async () => {
    signInAs("ben");
    jest.mocked(setLike).mockResolvedValueOnce({ status: "ok", liked: true, likeCount: 3 });
    await expect(setPostLike("p1", true)).resolves.toEqual({
      ok: true,
      data: { liked: true, likeCount: 3 },
    });
    expect(setLike).toHaveBeenLastCalledWith("p1", "ben", true);

    jest.mocked(setLike).mockResolvedValueOnce({ status: "ok", liked: false, likeCount: 2 });
    await expect(setPostLike("p1", false)).resolves.toEqual({
      ok: true,
      data: { liked: false, likeCount: 2 },
    });
    expect(setLike).toHaveBeenLastCalledWith("p1", "ben", false);
  });
});
