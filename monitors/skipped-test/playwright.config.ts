import { relative, resolve } from "node:path";

import { defineConfig } from "@playwright/test";

// testDir is the repo root so that the junit reporter's classname is
// repository-relative: it uses the path from rootDir, and both classname and file
// feed test identity.
const repoRoot = resolve(import.meta.dirname, "../..");
const packagePath = relative(repoRoot, import.meta.dirname);

export default defineConfig({
  testDir: repoRoot,
  testMatch: [`${packagePath}/**/*.spec.ts`],

  // Playwright wipes outputDir on start, so it must not be test-results itself:
  // that is where the vitest report lives, and CI runs vitest first.
  outputDir: "test-results/artifacts",

  retries: 0,
  workers: 1,
  fullyParallel: false,
  forbidOnly: false,
  maxFailures: 0,

  // includeRetries is what puts every attempt in the XML as a run.
  reporter: [
    ["list"],
    [
      "junit",
      {
        // Relative to cwd, which pnpm sets to this package.
        outputFile: "test-results/playwright.junit.xml",
        includeRetries: true,
      },
    ],
  ],

  // No browser: these stories exercise the runner, not a page.
  use: {},
});
