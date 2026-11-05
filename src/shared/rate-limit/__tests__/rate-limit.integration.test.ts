import { prisma, resetDatabase } from "@/shared/db/__tests__/test-db";

import { consumeRateLimit } from "../rate-limit";

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const rule = { limit: 3, windowSeconds: 60 };

describe("consumeRateLimit (real SQL)", () => {
  it("allows up to the limit, then rejects with seconds until reset", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await consumeRateLimit("key", rule));

    expect(results.slice(0, 3)).toEqual([
      { allowed: true, remaining: 2 },
      { allowed: true, remaining: 1 },
      { allowed: true, remaining: 0 },
    ]);
    for (const denied of results.slice(3)) {
      expect(denied).toMatchObject({ allowed: false });
      if (!denied.allowed) {
        expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
        expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
      }
    }
  });

  it("starts a fresh window once the old one has passed", async () => {
    for (let i = 0; i < 4; i++) await consumeRateLimit("key", rule);
    await prisma.rateLimit.update({
      where: { key: "key" },
      data: { windowStart: new Date(Date.now() - 61_000) },
    });
    await expect(consumeRateLimit("key", rule)).resolves.toEqual({ allowed: true, remaining: 2 });
  });

  it("reports the remaining time in the window", async () => {
    for (let i = 0; i < 3; i++) await consumeRateLimit("key", rule);
    await prisma.rateLimit.update({
      where: { key: "key" },
      data: { windowStart: new Date(Date.now() - 45_000) },
    });
    const result = await consumeRateLimit("key", rule);
    expect(result).toMatchObject({ allowed: false });
    if (!result.allowed) expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(14);
    if (!result.allowed) expect(result.retryAfterSeconds).toBeLessThanOrEqual(16);
  });

  it("keeps keys independent", async () => {
    for (let i = 0; i < 4; i++) await consumeRateLimit("a", rule);
    await expect(consumeRateLimit("b", rule)).resolves.toEqual({ allowed: true, remaining: 2 });
  });

  it("counts concurrent requests exactly (no lost updates)", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeRateLimit("burst", { limit: 4, windowSeconds: 60 })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(4);
    const row = await prisma.rateLimit.findUniqueOrThrow({ where: { key: "burst" } });
    expect(row.count).toBe(10);
  });
});
