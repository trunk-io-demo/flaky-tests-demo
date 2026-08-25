# `integrations/`

Per-framework upload wiring: what each test framework needs in order for its output to reach the
product correctly.

| Package                      | What it is                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`playwright/`](playwright/) | Post-processing for playwright's JUnit output. Used by the two playwright stories in [`monitors/`](../monitors/). |
| [`swift/`](swift/)           | A minimal Swift Testing suite, plus the post-processing its output needs. The first suite of its own here.        |

## `playwright/`

Playwright's built-in JUnit reporter writes `classname` but no `file` attribute, and the uploader needs
`file` to correlate a test with its code owner. With `testDir` at the repository root the classname
already _is_ the repo-relative path, so `junit-add-file-attribute` copies it across.

It is exposed as a bin, so a package that depends on it can call it by name:

```jsonc
"test:e2e": "playwright test; status=$?; junit-add-file-attribute test-results/playwright.junit.xml; exit $status"
```

The `status` dance matters: these stories fail on purpose, and the post-step must run without swallowing
the runner's exit code.

## `swift/`

The first framework suite here, and the pattern the rest should follow: a handful of tests whose only
job is to emit one of each JUnit shape the framework can produce, with what running them taught us
written down beside them. [`swift/README.md`](swift/README.md) has the findings — the output filename
SwiftPM actually writes, why display names never reach the XML, and the parameterized-test collapse.

Its post-processor solves the same problem as playwright's and cannot share the solution: Swift's
`classname` is `Module.TypeName`, not a path, so it resolves type names against the declarations under
`Tests/` instead of copying the classname across.

## Adding a suite

Give it a `package.json` with a `test` script and it is picked up — conflicting dependency trees
between frameworks being the entire point, so each suite carries its own manifest. The composite
action at [`.github/actions/integrations/`](../.github/actions/integrations/action.yaml) runs
`pnpm --filter "./integrations/**" --if-present run test`, so no workflow edit is needed. `playwright/`
has no `test` script and is skipped.

Two things a new suite has to do in the same commit:

- Add its importer to [`pnpm-lock.yaml`](../pnpm-lock.yaml). CI installs with `--frozen-lockfile`, so a
  missing entry fails the job rather than resolving it.
- If it needs Rust, add it to `members` or `exclude` in the root [`Cargo.toml`](../Cargo.toml) — Cargo
  treats a nested package that is neither as a **hard error**.

Framework breadth is not the story this repo leads with; see the predecessor repo
`trunk-io/flake-farm` for the version that does.
