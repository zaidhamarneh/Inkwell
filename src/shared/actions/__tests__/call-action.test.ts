import { callAction } from "../call-action";

describe("callAction", () => {
  it("returns the action's own result, success or error", async () => {
    await expect(callAction(() => Promise.resolve({ ok: true, data: 1 } as const))).resolves.toEqual({
      ok: true,
      data: 1,
    });
    const error = { ok: false, error: { code: "FORBIDDEN", message: "No" } } as const;
    await expect(callAction(() => Promise.resolve(error))).resolves.toEqual(error);
  });

  it("turns a thrown call (proxy 401, network error) into an error result", async () => {
    const result = await callAction(() => Promise.reject(new Error("unexpected response")));
    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
  });
});
