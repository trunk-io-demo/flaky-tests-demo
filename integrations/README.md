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

## The four modes

`swift test` and `xcodebuild` disagree about what a test result even contains, and the uploader has
three different ways of deciding which file a test lives in. That is four combinations, and this
folder runs all four over the same five tests — so the thing being compared is the attribution, not
the tests.

| Mode                    | Runner | Report                         | `file` comes from                        | Where            |
| ----------------------- | ------ | ------------------------------ | ---------------------------------------- | ---------------- |
| `xunit`                 | Linux  | `swift test --xunit-output`    | `junit-add-file-attribute`, in this repo | hourly + each PR |
| `xunit-declarations`    | Linux  | `swift test --xunit-output`    | `--swift-test-xunit-paths`, in the CLI   | hourly + each PR |
| `xcresult`              | macOS  | `xcodebuild -resultBundlePath` | the failure that surfaced the test       | daily            |
| `xcresult-declarations` | macOS  | `xcodebuild -resultBundlePath` | `sourcekit-lsp`, via the env var below   | daily            |

The two `declarations` modes are the interesting halves. `swift test` writes **no** `file` for any
test and an `.xcresult` records only where a failure was _raised_, so in both plain modes a passing
test is either attributed by hand or not attributed at all. Asking a language server where the test
is _declared_ fixes both, and is the only way a passing test in an `.xcresult` ever gets a file.

`xcresult-declarations` is the mode that sets
`TRUNK_USE_EXPERIMENTAL_XCRESULT_TEST_LOCATIONS=true`. Three traps in it, all of which cost a
debugging session if you meet them cold:

- **It is macOS-only and xcresult-only.** The flag is compiled out on Linux and does nothing for a
  JUnit or Bazel BEP upload, so setting it anywhere but this one mode is a silent no-op.
- **Do not set it to `false` to turn it off.** `clap` counts an env-supplied value as present
  whatever it says. Unset the variable instead — which is why the plain `xcresult` mode is a separate
  upload step rather than the same step with a conditional value.
- **The variable is not the constant.** `TRUNK_USE_EXPERIMENTAL_XCRESULT_TEST_LOCATIONS_ENV` is the
  Rust identifier that _holds_ the name; the variable itself has no `_ENV` suffix.

**The mode is the variant.** All four upload to `INTEGRATIONS_TEST_COLLECTION`, and what keeps them
apart is that `variant` is part of test identity — repository, `file`, `classname`, suite path,
`name`, `variant` — while attribution is not. Without it the four legs would be four runs of one
test rather than four attribution paths to compare, which is the whole point of running them.

Landing this **reset the Swift tests' history**: they previously uploaded with no variant, and
tagging them starts new tests as far as the product is concerned. The old variant-less rows keep
their history and stop receiving runs. This was a deliberate trade for being able to tell the four
apart, taken with the alternative — a collection per mode — on the table.

**Both `declarations` modes need an uploader newer than `0.15.4`**, the last release without
`--swift-test-xunit-paths` or the xcresult locations flag. `0.15.5-beta.2` is the first build that
runs them as documented, so `ANALYTICS_CLI_PRE_RELEASE_TEST_VERSION` has to name it or something
later — see [what cannot be verified here](#what-you-cannot-verify-here) for what happens if it does
not.

**`xunit-declarations` passes no `junit-paths` at all.** That is the point of it: the swift flag is
the only report source, so every test's file comes from where a language server says it is declared
rather than from the post-processor. Naming the report under both flags would upload it twice — the
two lists are appended rather than reconciled, measured at 6 cases for the 3-case suite, once
carrying the resolved file and once carrying none, which are two distinct `gen_info_id`s because
`file` is an input to it.

Until `0.15.5-beta.2` the flag could not be passed alone: the CLI required one of `junit-paths`,
`bazel-bep-path`, or `test-reports` regardless, so this leg carried a `junit-paths` glob aimed at a
directory that did not exist, purely to satisfy the parser.
[`analytics-cli#1198`](https://github.com/trunk-io/analytics-cli/pull/1198) fixed that, and the glob
is gone.

## What you cannot verify here

`trunk check --all` and a local `pnpm --filter ... test` prove the suites run and the post-processor
writes what it claims. They prove nothing about attribution reaching the product. Three things a
human has to confirm on the first green run of each mode, worst first:

- **`-scheme SwiftTestingUpload`** depends on Xcode generating a scheme named for the package's
  library product. It got no scheme at all when the package declared only a test target, which is
  what [`Package.swift`](swift/Package.swift)'s product is there to fix. If the `.xcresult` modes
  fail, check `xcodebuild -list` before anything else.
- **Whether the `xcresult` modes differ from each other at all.** They should: plain leaves passing
  tests with no `file`, declarations gives all five one. Identical `file` coverage across the two
  variants means the env var is not reaching the CLI.
- **That all four variants appear**, and that `xunit-declarations` reports a `file` for every test
  without the post-processor having written one.

The reason each of those is a human check rather than a job status: the uploader hands back
`using quarantining exit code` and exits **zero** when it errors on its own inputs, so a leg given a
report that was never written uploads nothing and still goes green. That is not hypothetical — it is
how a scheme name matching no scheme passed for a whole run. The "Check the suites produced a
report" step exists for exactly that, but it can only prove a file is present, not that its contents
reached the product.

Worth knowing if the uploader is ever moved back to a version predating these flags:
`xcresult-declarations` has its variable ignored and **silently** uploads exactly what plain
`xcresult` does, which is why `ANALYTICS_CLI_PRE_RELEASE_TEST_VERSION` wants a build that has them.

## Adding a suite

Give it a `package.json` with a `test` script and it is picked up — conflicting dependency trees
between frameworks being the entire point, so each suite carries its own manifest. The composite
action at [`.github/actions/integrations/`](../.github/actions/integrations/action.yaml) maps each
mode to a script and runs `pnpm --filter "./integrations/**" --if-present run <script>`, so no
workflow edit is needed:

| Mode                    | Script              |
| ----------------------- | ------------------- |
| `xunit`                 | `test`              |
| `xunit-declarations`    | `test:declarations` |
| `xcresult`              | `test:xcresult`     |
| `xcresult-declarations` | `test:xcresult`     |

A suite implements whichever modes make sense for it and is skipped by `--if-present` in the rest —
`playwright/` has none of them and is skipped everywhere. The one place a new suite does need a CI
edit is `xcresult-path`, which takes a single bundle rather than a glob and so names
`integrations/swift/` outright.

Two things a new suite has to do in the same commit:

- Add its importer to [`pnpm-lock.yaml`](../pnpm-lock.yaml). CI installs with `--frozen-lockfile`, so a
  missing entry fails the job rather than resolving it.
- If it needs Rust, add it to `members` or `exclude` in the root [`Cargo.toml`](../Cargo.toml) — Cargo
  treats a nested package that is neither as a **hard error**.

Framework breadth is not the story this repo leads with; see the predecessor repo
`trunk-io/flake-farm` for the version that does.
