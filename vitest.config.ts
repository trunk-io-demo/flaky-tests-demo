import { defineConfig } from "vitest/config";

/**
 * Root aggregate config, for running every vitest story at once from the repo
 * root (`pnpm test:vitest`). CI does not use this file — it iterates workspace
 * members with `pnpm --recursive`, so each package's own `test` script and its
 * own `vitest.config.ts` are the authoritative definition of what runs.
 *
 * The include/exclude split lives in each package's config rather than here:
 * with no language directory between a package and its test files, vitest's
 * default `include` would pick up the `*.spec.ts` playwright files sitting
 * beside the `*.test.ts` ones and fail on the mismatched `test` import.
 */
export default defineConfig({
  test: {
    projects: ["monitors/*", "apps/*"],
  },
});
