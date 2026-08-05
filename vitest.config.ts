import { defineConfig } from "vitest/config";

// Aggregate config for running every vitest story from the repo root. CI does not
// use it: each package's own config is authoritative.
export default defineConfig({
  test: {
    projects: ["monitors/*", "apps/*"],
  },
});
