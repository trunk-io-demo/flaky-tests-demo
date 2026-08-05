# `integrations/`

Per-framework upload wiring: what each test framework needs in order for its output to reach the
product correctly.

| Package                      | What it is                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`playwright/`](playwright/) | Post-processing for playwright's JUnit output. Used by the two playwright stories in [`monitors/`](../monitors/). |

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

## Still to come

One minimal test suite per framework, each existing only to demonstrate that its JUnit output uploads
correctly — conflicting dependency trees between frameworks being the entire point, so each will carry
its own `package.json`. Framework breadth is not the story this repo leads with; see the predecessor
repo `trunk-io/flake-farm` for the version that does.

A composite action already exists at `.github/actions/integrations/`, so wiring suites into a workflow
is one `uses:` line. If a suite needs Rust it must be added to `members` or `exclude` in the root
[`Cargo.toml`](../Cargo.toml) in the same commit — Cargo treats a nested package that is neither as a
**hard error**.
