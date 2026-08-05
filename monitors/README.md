# `monitors/` — one package per monitor, one story each

Trunk Flaky Tests offers several different [monitor types](https://docs.trunk.io/flaky-tests/detection/index#monitor-types). Each one is built to track a different type of flakiness, or a different pattern of behavior. This directory serves to exhibit the canonical behavior each monitor is meant to track.

This directory serves as its own test collection, based on the upload configuration.

Every package contains, at minimum:

- a **healthcheck test that always passes**, and
- a small number of tests that trip that monitor.

Each package's own README enumerates its tests. This page stays at one row per monitor.

> [!NOTE]
> Changing anything here? [`CLAUDE.md`](CLAUDE.md) has the conventions.

| Monitor                                    | Detects                                                          | The story here                                                           |
| ------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`failure-rate/`](failure-rate/)           | What percentage of recent runs failed on a given branch pattern. | A ladder from 10% to 100%, plus branch- and weekday-dependent rates.     |
| [`failure-count/`](failure-count/)         | How many failures in a window.                                   | Counts that swing with the branch class, plus two on a calendar.         |
| [`skipped-test/`](skipped-test/)           | Tests that stopped running without being deleted.                | A serial cascade, plus two quieter ways it happens.                      |
| [`new-test/`](new-test/)                   | Highlight new tests or flag when they're new on a given branch.  | One genuinely new test per day, on a rolling window.                     |
| [`slow-test/`](slow-test/)                 | Track tests whose quintile duration is above a threshold.        | A gradual ramp, a bimodal spike, a flat control, and a contention queue. |
| [`pass-on-retry/`](pass-on-retry/)         | A test that failed and then passed on the same commit(s).        | A retry ladder pairing in one upload, and low rates pairing across them. |
| [`timeout-inflation/`](timeout-inflation/) | A test that only runs slower when it fails.                      | A downstream call that times out, against a fail-fast control.           |

## Usage

From the repository root, across every package:

```bash
pnpm install
pnpm test              # vitest, writes test-results/junit.xml per package
pnpm test:e2e          # playwright, writes test-results/playwright.junit.xml
```

Or one story at a time:

```bash
pnpm --filter @flaky-tests-demo/monitor-failure-count test
pnpm --filter @flaky-tests-demo/monitor-skipped-test test:e2e
```

**Non-zero exit codes are expected.** These tests fail on purpose, so both root scripts use
`--no-bail` and the workflow deliberately does not forward the exit code — a job's status reports
upload health, not test results. Run `pnpm test; echo $?` rather than chaining with `&&`, or a
deliberate failure will stop the run.

Reports land in each package's `test-results/`, which is what the uploader is pointed at:

```text
monitors/failure-count/test-results/junit.xml
monitors/skipped-test/test-results/playwright.junit.xml
```

Playwright writes its artifacts to `test-results/artifacts/` instead, because it wipes `outputDir`
on start and would otherwise delete the vitest report next to it.

To see what would be uploaded without uploading:

```bash
trunk-analytics-cli validate $(printf -- '--junit-paths %s ' monitors/*/test-results/*.xml)
```

[`utils/`](utils/) is not a monitor: it holds the helpers the stories share — branch class, UTC dates, and
seeded randomness — and has no tests of its own.
