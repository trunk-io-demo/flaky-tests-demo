# `monitors/` — one package per monitor, one story each

Trunk Flaky Tests offers several different [monitor types](https://docs.trunk.io/flaky-tests/detection/index#monitor-types). Each one is built to track a different type of flakiness, or a different pattern of behavior. This directory serves to exhibit the canonical behavior each monitor is meant to track.

This directory serves as its own test collection, based on the upload configuration.

Every package contains, at minimum:

- a **healthcheck test that always passes**, and
- a small number of tests that trip that monitor.

> [!NOTE]
> Changing anything here? [`CLAUDE.md`](CLAUDE.md) has the conventions, including keeping the index below
> current.

| Monitor                                    | Detects                                                          | The story here                                                       |
| ------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`failure-rate/`](failure-rate/)           | What percentage of recent runs failed on a given branch pattern. | A ladder from 10% to 100%, plus branch- and weekday-dependent rates. |
| [`failure-count/`](failure-count/)         | How many failures in a window.                                   | A burst: four of twelve fail every run, deterministically.           |
| [`skipped-test/`](skipped-test/)           | Tests that stopped running without being deleted.                | A serial cascade, plus two quieter ways it happens.                  |
| [`new-test/`](new-test/)                   | Highlight new tests or flag when they're new on a given branch.  | One genuinely new test per day, on a rolling window.                 |
| [`slow-test/`](slow-test/)                 | Track tests whose quintile duration is above a threshold.        | A gradual ramp, a bimodal spike, and a flat control.                 |
| [`pass-on-retry/`](pass-on-retry/)         | A test that failed and then passed on the same commit(s).        | A retry ladder, plus a reporter that keeps every attempt.            |
| [`timeout-inflation/`](timeout-inflation/) | A test that only runs slower when it fails.                      | A real timeout race, against a fail-fast control.                    |

[`utils/`](utils/) is not a monitor: it holds the helpers the stories share — branch class, UTC dates,
seeded randomness, and the runner's OS — and has no tests of its own.

## Index of tests

Every test in this directory. Keep it current.

### [`failure-rate/`](failure-rate/) · [`canonical.test.ts`](failure-rate/canonical.test.ts)

| Test                                               | Behavior                           |
| -------------------------------------------------- | ---------------------------------- |
| `healthcheck always passes`                        | Never fails.                       |
| `fails 10 percent` … `fails 100 percent`           | A ladder in steps of ten.          |
| `fails 40 percent on prs and 20 percent elsewhere` | Halves outside pull requests.      |
| `fails 80 percent on prs and 40 percent elsewhere` | Halves outside pull requests.      |
| `fails at a rate that climbs through the week`     | 10% Sunday rising to 70% Saturday. |

### [`failure-count/`](failure-count/) · [`canonical.test.ts`](failure-count/canonical.test.ts)

| Test                                  | Behavior                       |
| ------------------------------------- | ------------------------------ |
| `healthcheck always passes`           | Never fails.                   |
| `always fails PB`                     | Every `PB` run.                |
| `sometimes fails PB 10/20/30 percent` | 10%, 20%, 30% of `PB` runs.    |
| `always fails PR`                     | Every `PR` run.                |
| `sometimes fails PR 10/20/30 percent` | 10%, 20%, 30% of `PR` runs.    |
| `always fails MQ`                     | Every `MQ` run.                |
| `sometimes fails MQ 10/20/30 percent` | 10%, 20%, 30% of `MQ` runs.    |
| `fails on mondays`                    | Every run on a Monday, UTC.    |
| `fails every other day`               | Every run on alternating days. |

### [`skipped-test/`](skipped-test/) · [`cascade.spec.ts`](skipped-test/cascade.spec.ts)

Playwright, serial. **The canonical case:** the setup fails and the runner declines to attempt the rest,
so one failure hides five tests' worth of coverage behind it.

| Test                                             | Behavior                              |
| ------------------------------------------------ | ------------------------------------- |
| `healthcheck always passes`                      | Never fails. Runs before the cascade. |
| `the setup step that everything else depends on` | Fails 60% of runs.                    |
| `reads the seeded fixture`                       | Skipped when it does; else fails 2%.  |
| `updates the seeded fixture`                     | Skipped, else 4%.                     |
| `reindexes after the update`                     | Skipped, else 6%.                     |
| `reconciles the audit log`                       | Skipped, else 8%.                     |
| `tears the fixture down`                         | Skipped, else 10%.                    |

### [`skipped-test/`](skipped-test/) · [`canonical.test.ts`](skipped-test/canonical.test.ts)

The two quieter ways it happens.

| Test                                       | Behavior                                                          |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `healthcheck always passes`                | Never fails, never skips.                                         |
| `always skipped never deleted`             | `it.skip`. Has not executed since somebody typed four characters. |
| `sometimes skipped by a runtime condition` | Skips 40% of runs. Partial history looks maintained.              |
| `never skipped`                            | The control.                                                      |

### [`new-test/`](new-test/) · [`canonical.test.ts`](new-test/canonical.test.ts)

| Test                            | Behavior                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `healthcheck always passes`     | Never fails.                                                             |
| `first appeared on <date>` × 21 | One per day of a rolling window, failing at a rate that decays with age. |

### [`slow-test/`](slow-test/) · [`canonical.test.ts`](slow-test/canonical.test.ts)

| Test                                            | Behavior                                       |
| ----------------------------------------------- | ---------------------------------------------- |
| `healthcheck always passes`                     | Never fails, never slow.                       |
| `duration is stable`                            | The control. Flat duration.                    |
| `duration grows a little each day`              | Ramps over a 14-day cycle, then resets.        |
| `duration is usually fast but sometimes is not` | Bimodal: 10% of runs take eight times as long. |

### [`pass-on-retry/`](pass-on-retry/) · [`retry-ladder.spec.ts`](pass-on-retry/retry-ladder.spec.ts)

Playwright, three retries. Pairs form **within one upload**.

| Test                           | Behavior                                            |
| ------------------------------ | --------------------------------------------------- |
| `passes on the first attempt`  | The control. Never retried, so never pairs.         |
| `passes on the second attempt` | Fails once, then passes.                            |
| `passes on the third attempt`  | Fails twice, then passes.                           |
| `passes on the fourth attempt` | Fails three times, then passes.                     |
| `never passes`                 | Fails every attempt. **Not** a pair — the boundary. |

### [`pass-on-retry/`](pass-on-retry/) · [`canonical.test.ts`](pass-on-retry/canonical.test.ts)

Vitest, no retries. Pairs form **across uploads**, since scheduled runs share a head commit.

| Test                                                   | Behavior                                       |
| ------------------------------------------------------ | ---------------------------------------------- |
| `healthcheck always passes`                            | Never fails.                                   |
| `fails 1 percent, pairing across uploads`              | Fails 1% of runs.                              |
| `fails 10 percent, pairing across uploads`             | Fails 10% of runs.                             |
| `retried twice by vitest and reported as a plain pass` | Shows that vitest's reporter discards retries. |

### [`timeout-inflation/`](timeout-inflation/) · [`canonical.test.ts`](timeout-inflation/canonical.test.ts)

| Test                                     | Behavior                                                      |
| ---------------------------------------- | ------------------------------------------------------------- |
| `healthcheck always passes`              | Never fails, never blocks.                                    |
| `blocks on a timeout only when it fails` | ~150ms when it passes; blocks to a ~5s ceiling when it fails. |
| `fails fast when it fails`               | The control. Same failure rate, returns immediately.          |
