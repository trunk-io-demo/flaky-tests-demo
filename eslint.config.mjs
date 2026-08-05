import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "target/**",
    ],
  },
  js.configs.recommended,
  {
    // typescript-eslint turns no-undef off for .ts, where the type checker covers
    // it. Plain ESM tooling still needs the globals declared.
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // Stories are read as documentation. An unused binding in a test file is
      // almost always a half-finished thought, so it should fail lint.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  },
);
