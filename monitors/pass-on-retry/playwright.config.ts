import { relative, resolve } from "node:path";

import { defineConfig } from "@playwright/test";

/**
 * Rooted at the repository for the same reason the vitest configs are: `file`
 * and `classname` feed test identity, and a package-relative path both collides
 * across packages and matches nothing in CODEOWNERS.
 */
const repoRoot = resolve(import.meta.dirname, "../..");
const packagePath = relative(repoRoot, import.meta.dirname);

export default defineConfig({
  testDir: import.meta.dirname,
  // `*.test.ts` in this folder belongs to vitest. Without an explicit match,
  // playwright's default glob claims it too.
  testMatch: ["**/*.spec.ts"],

  /**
   * Three retries, so up to four attempts.
   *
   * This is the mechanism, not a robustness setting. Playwright reports every
   * attempt, and the JUnit parser expands those into separate run rows — so a
   * **single upload** contains both the failure and the success that a
   * pass-on-retry pair needs. No two-workflow retry dance, and no risk of the
   * early pairs ageing out of the evaluation window before the late ones land.
   */
  retries: 3,

  // Retries and parallelism do not mix well for a story about attempt counts:
  // the ladder below is easier to read in the report when its attempts are
  // sequential.
  workers: 1,
  fullyParallel: false,

  // Deliberate failures are the point, so a red run must not be treated as a
  // reason to stop, and must not be reported as a CI-configuration mistake.
  forbidOnly: false,
  maxFailures: 0,

  // The reporter is a local one rather than playwright's built-in `junit`.
  // The built-in collapses retries into a single testcase, which makes
  // pass-on-retry undetectable from its output. That is the whole story here, so
  // it is worth 150 lines to fix.
  reporter: [
    ["list"],
    [
      "./junit-reporter.ts",
      { outputFile: `${packagePath}/test-results/playwright.junit.xml` },
    ],
  ],

  // No browser. Every playwright story in this repo exercises the runner's retry
  // and reporting behavior rather than a page, so CI never needs
  // `playwright install` — which would otherwise be the slowest step in the
  // hourly run.
  use: {},
});
