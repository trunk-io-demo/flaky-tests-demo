# `integrations/swift/`

Swift Testing upload wiring. A minimal suite whose only job is to demonstrate that Swift's JUnit
output reaches the product correctly, plus the post-processing it needs to get there.

Swift Testing ships with the toolchain as of Swift 6, so `import Testing` needs no package
dependency and no developer snapshot. The package has no dependencies at all, and CI runs it on
`ubuntu-latest` — nothing here is macOS-only.

## What the suite covers

| Test                                         | Reports as                                           |
| -------------------------------------------- | ---------------------------------------------------- |
| `UploadShapes/passes`                        | A bare `<testcase>`                                  |
| `UploadShapes/hostileCharacters`             | `<failure>` carrying quotes, `&`, `<`, and emoji     |
| `UploadShapes/skipped`                       | `<skipped>`, via the `.disabled` trait               |
| `UploadShapes/knownIssue`                    | A **pass** — `withKnownIssue` suppresses the failure |
| `ParameterizedShapes/collapsesToOneTestcase` | One `<testcase>` with two `<failure>` children       |

`hostileCharacters` fails on purpose: an escaping bug in the reporter is only visible in a failure
message, so the only way to assert the message survives the round trip is to produce one.

## What running it taught us

**The output filename is not the one you pass.** SwiftPM writes one file per testing library and
inserts the library's name before the extension, so `--xunit-output test-results/swift.xml` produces
`test-results/swift-swift-testing.xml`. Both the `test` script and the composite action's glob
account for this.

**Display names never reach the XML.** JUnit identity is the symbol: `classname` is
`SwiftTestingUploadTests.<type>` and `name` is `<function>()`. Renaming `@Test("passes")` costs
nothing; renaming `passes()` starts a new test as far as the product is concerned. Renaming the
enclosing `struct` does too.

**There is no `<error>`.** A thrown error and a failed `#expect` both land as `<failure>`, and
`errors` is always `0`. Swift is not like the playwright suites, where the two are distinguishable.

**`try #require` is not a skip.** It reports a `<failure>` and stops the test. The only skip Swift
Testing emits is the `.disabled` trait (or `.enabled(if:)`).

**`tests` undercounts.** A skipped test is emitted as a `<testcase>` but excluded from the
`testsuite` `tests` attribute, so the attribute and the child count disagree by the number of skips.

**Parameterized tests lose per-argument identity.** Every argument collapses into a single
`<testcase>` named for the function, with one `<failure>` child per failing argument — a shape most
JUnit consumers do not expect. A Swift test that needs one row per case has to be written as separate
functions.

**There is no `timestamp`.** Swift Testing writes none, on the suite or the cases, and the uploader
warns about it. The post-processor stamps one; see below.

With both fixes applied, `trunk-analytics-cli validate` reports the report as clean — 0 warnings and
0 errors. Without them it reports the missing timestamp and the tests carry no code owner.

## `junit-add-file-attribute`

Swift Testing writes `classname` but no `file`, and the uploader needs `file` to correlate a test
with its code owner. The [`playwright/`](../playwright/) post-processor copies `classname` across
because there the classname already _is_ the repo-relative path; that does not work here, because
Swift's classname is `Module.TypeName`.

So this one indexes the `struct`, `class`, `enum`, and `actor` declarations under `Tests/` and
resolves the last component of each classname against it, writing paths relative to the repository
root. A type name declared in two files is dropped rather than guessed at, and any classname it
cannot resolve is an error — a test uploaded without `file` silently loses its code owner, which is
worth failing the job over.

The declaration pattern is deliberately not anchored to the start of a line: a suite type is normally
declared after its attribute, as in `@Suite("name") struct Thing {`, and an anchored pattern silently
matches nothing.

It also stamps the `timestamp` Swift Testing omits. The report's mtime is when the run finished, so
the suite's own `time` is subtracted to approximate when it started. Both passes are idempotent —
re-running leaves an already-processed report untouched.

It is exposed as a bin, so another package can call it by name:

```jsonc
"test": "swift test --xunit-output test-results/swift.xml; status=$?; junit-add-swift-file-attribute test-results/swift-swift-testing.xml; exit $status"
```

The `status` dance matters: these tests fail on purpose, and the post-step must run without
swallowing the runner's exit code.

## Running it

```bash
pnpm --filter @flaky-tests-demo/integrations-swift test
```

Or without a local toolchain:

```bash
docker run --rm -v "$PWD":/work -w /work swift:6.1 \
  bash -c 'mkdir -p test-results && swift test --xunit-output test-results/swift.xml'
```
