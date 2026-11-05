import { prisma } from "@/shared/db/db";

import { consumeRateLimit } from "../rate-limit";

jest.mock("@/shared/db/db", () => ({ prisma: { $queryRaw: jest.fn() } }));

const mockQuery = jest.mocked(prisma.$queryRaw);
const rule = { limit: 3, windowSeconds: 60 };

describe("consumeRateLimit (logic; the SQL itself is covered by the integration tests)", () => {
  it("allows requests up to the limit and reports what's left", async () => {
    mockQuery.mockResolvedValueOnce([{ count: 1, retryAfter: 60 }] as never);
    await expect(consumeRateLimit("k", rule)).resolves.toEqual({ allowed: true, remaining: 2 });

    mockQuery.mockResolvedValueOnce([{ count: 3, retryAfter: 40 }] as never);
    await expect(consumeRateLimit("k", rule)).resolves.toEqual({ allowed: true, remaining: 0 });
  });

  it("rejects over the limit with the seconds until the window resets", async () => {
    mockQuery.mockResolvedValueOnce([{ count: 4, retryAfter: 17 }] as never);
    await expect(consumeRateLimit("k", rule)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 17,
    });
  });
});
