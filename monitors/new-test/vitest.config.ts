import { relative, resolve } from "node:path";

import { defineConfig } from "vitest/config";

// Rooted at the repository, not this package: vitest resolves `file` and
// `classname` against `root`, and both feed test identity. Derived, not typed,
// so this file copies into a new package unchanged.
const repoRoot = resolve(import.meta.dirname, "../..");
const packagePath = relative(repoRoot, import.meta.dirname);

export default defineConfig({
  root: repoRoot,
  test: {
    // `*.spec.ts` belongs to playwright.
    include: [`${packagePath}/**/*.test.ts`],
    exclude: ["**/*.spec.ts", "**/node_modules/**"],

    // A failing test here is the demo working, so every result must reach the
    // upload.
    bail: 0,

    // Several stories return early when the branch class does not apply. That is
    // a pass, not an error.
    expect: { requireAssertions: false },

    reporters: [
      "default",
      [
        "junit",
        {
          suiteName: packagePath,
          classnameTemplate: "{filename}",
          // Off by default, and without it CODEOWNERS has nothing to match.
          addFileAttribute: true,
        },
      ],
    ],
    outputFile: { junit: `${packagePath}/test-results/vitest.junit.xml` },
  },
});
