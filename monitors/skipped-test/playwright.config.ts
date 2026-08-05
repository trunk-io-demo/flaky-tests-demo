import { relative, resolve } from "node:path";

import { defineConfig } from "@playwright/test";

// Rooted at the repository: `file` and `classname` feed test identity.
const repoRoot = resolve(import.meta.dirname, "../..");
const packagePath = relative(repoRoot, import.meta.dirname);

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: ["**/*.spec.ts"],

  // A retried test that eventually passes is a pass-on-retry story, and would
  // give the cascade a second chance to not cascade.
  retries: 0,

  workers: 1,
  fullyParallel: false,
  forbidOnly: false,
  maxFailures: 0,

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
