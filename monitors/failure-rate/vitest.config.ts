import { relative, resolve } from "node:path";

import { defineConfig } from "vitest/config";

/**
 * `root` is the repository root, not this package.
 *
 * That is deliberate and it is about test identity. Identity is derived from
 * repository, `file`, `classname`, suite, name, and variant — and vitest
 * resolves both `file` and `classname` relative to its `root`. Rooted at the
 * package, every monitor's `canonical.test.ts` reports the same two values, so
 * two monitors' healthcheck tests would collide into one test in the product,
 * and the `file` attribute would not match anything in CODEOWNERS.
 *
 * Rooted at the repository, both are repo-relative and both are unique. The
 * paths below are derived rather than typed, so this file can be copied into a
 * new monitor package unchanged.
 */
const repoRoot = resolve(import.meta.dirname, "../..");
const packagePath = relative(repoRoot, import.meta.dirname);

export default defineConfig({
  root: repoRoot,
  test: {
    // Load-bearing, not defensive. With no language directory between them,
    // `*.test.ts` and `*.spec.ts` share a folder, and vitest's default glob
    // would claim the playwright specs and fail on their `test` import.
    include: [`${packagePath}/**/*.test.ts`],
    exclude: ["**/*.spec.ts", "**/node_modules/**"],

    // A failing test here is the product working, so the run must not stop at
    // the first one — every test's result has to reach the upload.
    bail: 0,

    reporters: [
      "default",
      [
        "junit",
        {
          suiteName: packagePath,
          classnameTemplate: "{filename}",
          // Off by default, and without it there is no `file` attribute for
          // CODEOWNERS to match against, so failures arrive with no owner.
          addFileAttribute: true,
        },
      ],
    ],
    outputFile: { junit: `${packagePath}/test-results/vitest.junit.xml` },
  },
});
