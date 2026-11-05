import { z } from "zod";

import { Errors } from "@/shared/api/errors";
import { getServerSession } from "@/shared/auth/session";

import { idSchema, parseInput, requireActionUser, runAction } from "../run-action";

jest.mock("@/shared/auth/session", () => ({ getServerSession: jest.fn() }));

describe("runAction", () => {
  it("wraps a successful result", async () => {
    await expect(runAction("test", () => Promise.resolve(42))).resolves.toEqual({
      ok: true,
      data: 42,
    });
  });

  it("turns an ApiError into an error result", async () => {
    await expect(
      runAction("test", () => Promise.reject(Errors.forbidden("Not yours."))),
    ).resolves.toEqual({ ok: false, error: { code: "FORBIDDEN", message: "Not yours." } });
  });

  it("includes field errors", async () => {
    const result = await runAction("test", () =>
      Promise.reject(Errors.validation({ content: ["Write a comment"] })),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields are invalid.",
        fieldErrors: { content: ["Write a comment"] },
      },
    });
  });

  it("hides unexpected errors behind a generic message", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await runAction("test", () => Promise.reject(new Error("SQL secret")));
    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong on our end." },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    spy.mockRestore();
  });
});

describe("requireActionUser", () => {
  it("returns the signed-in user", async () => {
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } } as never);
    await expect(requireActionUser()).resolves.toEqual({ id: "u1" });
  });

  it("throws 401 when not signed in", async () => {
    jest.mocked(getServerSession).mockResolvedValue(null as never);
    await expect(requireActionUser()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
  });
});

describe("parseInput / idSchema", () => {
  it("returns parsed input", () => {
    expect(parseInput(z.object({ a: z.number() }), { a: 1 })).toEqual({ a: 1 });
  });

  it("throws VALIDATION_ERROR with field errors", () => {
    expect(() => parseInput(z.object({ a: z.number() }), { a: "x" })).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" }) as Error,
    );
  });

  it("rejects empty and oversized ids", () => {
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse("x".repeat(65)).success).toBe(false);
    expect(idSchema.safeParse("cmw3abc").success).toBe(true);
  });
});
