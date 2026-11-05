// Jest globalSetup for `bun run test:integration`: makes sure the test
// database exists and has the current schema (same migrations as the app).
import { execSync } from "node:child_process";

import pg from "pg";

import { assertIsTestDatabase, testDatabaseUrl } from "./jest.integration-env.mjs";

export default async function setup() {
  const url = testDatabaseUrl();
  const name = assertIsTestDatabase(url);

  // Create the database if needed, connecting to the server's default db.
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  await client.end();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
