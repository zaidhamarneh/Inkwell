// Shared by the integration test setup and every integration test file:
// works out the TEST database URL and points DATABASE_URL at it, so the app's
// Prisma client (src/shared/db/db.ts) talks to the test database.
//
// TEST_DATABASE_URL wins; otherwise it's DATABASE_URL with "_test" appended
// to the database name (inkwell → inkwell_test).

export function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL (or TEST_DATABASE_URL) to run integration tests.");
  }
  const url = new URL(process.env.DATABASE_URL);
  const name = url.pathname.replace(/^\//, "");
  url.pathname = `/${name.endsWith("_test") ? name : `${name}_test`}`;
  return url.toString();
}

/**
 * @param {string} urlString
 * @returns {string} the database name
 */
export function assertIsTestDatabase(urlString) {
  const name = new URL(urlString).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the database name must end in "_test".`,
    );
  }
  return name;
}

const url = testDatabaseUrl();
assertIsTestDatabase(url);
process.env.DATABASE_URL = url;
