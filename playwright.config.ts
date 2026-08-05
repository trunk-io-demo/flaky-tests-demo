import { defineConfig } from "@playwright/test";

// Aggregate config for running every playwright story from the repo root.
// testMatch is explicit because *.test.ts sits in the same directories.
export default defineConfig({
  testDir: ".",
  testMatch: ["monitors/*/**/*.spec.ts", "apps/*/**/*.spec.ts"],
  reporter: [["list"]],
  // No browsers: these stories exercise the runner, not a page.
  use: {},
});
