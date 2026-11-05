import nextJest from "next/jest.js";

// next/jest compiles TypeScript with SWC and loads .env like `next` does.
const createJestConfig = nextJest({ dir: "./" });

// Packages that ship only ES modules and must be compiled for Jest.
const esmPackages = [
  "better-auth",
  "@better-auth",
  "better-call",
  "@better-fetch",
  "jose",
  "nanostores",
  "rou3",
  "defu",
  "uncrypto",
  "superjson",
  "copy-anything",
  "is-what",
  "@noble",
  // Prisma 7 loads its query compiler from .mjs files (integration tests).
  "@prisma/client",
];

const integration = process.env.TEST_SCOPE === "integration";

/** @type {import("jest").Config} */
const config = {
  testEnvironment: "node",
  // Tests live next to the code they test, in __tests__ folders.
  //   *.test.ts             unit tests (mocked; `bun run test`)
  //   *.integration.test.ts real test database (`bun run test:integration`)
  testMatch: integration
    ? ["<rootDir>/src/**/__tests__/**/*.integration.test.ts"]
    : ["<rootDir>/src/**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: integration
    ? ["/node_modules/", "/.next/"]
    : ["/node_modules/", "/.next/", "\\.integration\\.test\\.ts$"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // server-only throws outside the React server build; it's a no-op here.
    "^server-only$": "<rootDir>/__mocks__/empty.js",
  },
  clearMocks: true,
  ...(integration && {
    globalSetup: "<rootDir>/jest.integration-setup.mjs",
    // Runs in each test file before any imports: points Prisma at the test db.
    setupFiles: ["<rootDir>/jest.integration-env.mjs"],
    // Integration tests share one database, so run them one at a time.
    maxWorkers: 1,
  }),
};

export default async function jestConfig() {
  const resolved = await createJestConfig(config)();
  return {
    ...resolved,
    transformIgnorePatterns: [
      `/node_modules/(?!(${esmPackages.join("|")})/)`,
      "^.+\\.module\\.(css|sass|scss)$",
    ],
  };
}
