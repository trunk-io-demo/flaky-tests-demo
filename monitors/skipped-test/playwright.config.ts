import { relative, resolve } from "node:path";

import { defineConfig } from "@playwright/test";

// Rooted at the repository: `file` and `classname` feed test identity, and a
// package-relative path collides across packages. Derived, not typed.
const repoRoot = resolve(import.meta.dirname, "../..");
const packagePath = relative(repoRoot, import.meta.dirname);

export default defineConfig({
  testDir: import.meta.dirname,
  // `*.test.ts` here belongs to vitest.
  testMatch: ["**/*.spec.ts"],

  // Zero retries. A retried test that eventually passes is a pass-on-retry
  // story, not a skipped-test one, and it would also give the cascade a second
  // chance to not cascade.
  retries: 0,

  // The cascade needs sequential execution to be a cascade.
  workers: 1,
  fullyParallel: false,

  forbidOnly: false,
  maxFailures: 0,

  // Playwright's built-in junit reporter does not write a `file` attribute and
  // resolves `classname` against the package. See junit-reporter.ts.
  reporter: [
    ["list"],
    [
      "./junit-reporter.ts",
      { outputFile: `${packagePath}/test-results/playwright.junit.xml` },
    ],
  ],

  // No browser: these stories exercise the runner, not a page.
  use: {},
});
