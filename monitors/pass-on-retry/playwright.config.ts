import { relative, resolve } from "node:path";

import { defineConfig } from "@playwright/test";

// Rooted at the repository: `file` and `classname` feed test identity.
const repoRoot = resolve(import.meta.dirname, "../..");
const packagePath = relative(repoRoot, import.meta.dirname);

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: ["**/*.spec.ts"],

  // The mechanism, not a robustness setting: every attempt is reported, so one
  // upload holds both halves of every pair.
  retries: 3,

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
