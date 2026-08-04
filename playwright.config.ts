import { defineConfig } from "@playwright/test";

/**
 * Root aggregate config, for running every playwright story at once from the
 * repo root (`pnpm test:e2e` at the root runs each package's own config
 * instead; this file is the "one command, everything" convenience).
 *
 * `testMatch` is explicit for the same reason the vitest config's is: the
 * `*.test.ts` vitest files live in the same directories as the `*.spec.ts`
 * playwright ones, and playwright's default match would claim both.
 */
export default defineConfig({
  testDir: ".",
  testMatch: ["monitors/*/**/*.spec.ts", "app/*/**/*.spec.ts"],
  reporter: [["list"]],
  // No browsers. Every playwright story here exercises the runner's retry and
  // reporting behavior, not a page, so CI never needs `playwright install`.
  use: {},
});
