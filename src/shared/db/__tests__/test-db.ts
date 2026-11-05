// Helpers for integration tests (*.integration.test.ts). Not a test file.
import { prisma } from "@/shared/db/db";

/** Empties every table (test database only; see jest.integration-env.mjs). */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "like", "comment", "post", "session", "account", "verification", "rate_limit", "user" CASCADE',
  );
}

export async function createUser(key: string) {
  return prisma.user.create({
    data: { id: `user-${key}`, name: `User ${key}`, email: `${key}@test.local` },
  });
}

export { prisma };
