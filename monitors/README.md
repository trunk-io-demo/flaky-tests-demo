# `monitors/` — one package per monitor, one story each

Trunk Flaky Tests offers several different [monitor types](https://docs.trunk.io/flaky-tests/detection/index#monitor-types). Each one is built to track a different type of flakiness, or a different pattern of behavior. This directory serves to exhibit the canonical behavior each monitor is meant to track.

This directory serves as its own test collection, based on the upload configuration.

Every package contains, at minimum:

- a **healthcheck test that always passes**, and
- a small number of tests that trip that monitor.

> [!NOTE]
> Changing anything in here? Read [`CLAUDE.md`](CLAUDE.md) first. It covers naming, the healthcheck
> rule, why renaming a test loses its history, and keeping the index below current.

| Monitor                                    | Detects                                                          | The story here                                             |
| ------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| [`failure-rate/`](failure-rate/)           | What percentage of recent runs failed on a given branch pattern. | Three tests differing only in their percentage.            |
| [`failure-count/`](failure-count/)         | How many failures in a window.                                   | A burst: four of twelve fail every run, deterministically. |
| [`skipped-test/`](skipped-test/)           | Tests that stopped running without being deleted.                | A serial cascade, plus two quieter ways it happens.        |
| [`new-test/`](new-test/)                   | Highlight new tests or flag when they're new on a given branch.  | One genuinely new test per day, on a rolling window.       |
| [`slow-test/`](slow-test/)                 | Track tests whose quintile duration is above a threshold.        | A gradual ramp, a bimodal spike, and a flat control.       |
| [`pass-on-retry/`](pass-on-retry/)         | A test that failed and then passed on the same commit(s).        | A retry ladder, plus a reporter that keeps every attempt.  |
| [`timeout-inflation/`](timeout-inflation/) | A test that only runs slower when it fails.                      | A real timeout race, against a fail-fast control.          |

[`utils/`](utils/) is not a monitor. It holds the helpers the stories share — what CI says about where
a run came from, UTC dates, and seeded randomness. It has no tests of its own.

## Index of tests

Every test in this directory and its subdirectories. Keep it current — see [`CLAUDE.md`](CLAUDE.md).

### [`failure-rate/`](failure-rate/) · [`canonical.test.ts`](failure-rate/canonical.test.ts)

| Test                        | Behavior                      |
| --------------------------- | ----------------------------- |
| `healthcheck always passes` | Never fails.                  |
| `fails on a low rate`       | Fails 8% of runs by default.  |
| `fails on a medium rate`    | Fails 30% of runs by default. |
| `fails on a high rate`      | Fails 65% of runs by default. |

### [`failure-count/`](failure-count/) · [`canonical.test.ts`](failure-count/canonical.test.ts)

The count's _size_ depends on where the run came from. Exactly one always-fails group fires per run,
so the branch class tells you which.

| Test                                          | Behavior                                              |
| --------------------------------------------- | ----------------------------------------------------- |
| `healthcheck always passes`                   | Never fails.                                          |
| `protected branch member 01` … `03`           | Fail on every `PB` run.                               |
| `pull request member 01` … `03`               | Fail on every `PR` run.                               |
| `merge queue member 01` … `03`                | Fail on every `MQ` run.                               |
| `protected branch sometimes member 01` … `03` | Fail 10% of `PB` runs.                                |
| `pull request sometimes member 01` … `03`     | Fail 10% of `PR` runs.                                |
| `merge queue sometimes member 01` … `03`      | Fail 10% of `MQ` runs.                                |
| `fails on mondays`                            | Fails every run on a Monday, UTC. A weekly spike.     |
| `fails every other day`                       | Fails on alternating days, anchored to the epoch day. |

### [`skipped-test/`](skipped-test/) · [`cascade.spec.ts`](skipped-test/cascade.spec.ts)

Playwright, serial. **The canonical case:** the first test fails and the runner declines to attempt
the rest, so one failure hides five tests' worth of coverage behind it.

| Test                                             | Behavior                              |
| ------------------------------------------------ | ------------------------------------- |
| `healthcheck always passes`                      | Never fails. Runs before the cascade. |
| `the setup step that everything else depends on` | The only real failure.                |
| `reads the seeded fixture`                       | Skipped — the serial group stopped.   |
| `updates the seeded fixture`                     | Skipped.                              |
| `reindexes after the update`                     | Skipped.                              |
| `reconciles the audit log`                       | Skipped.                              |
| `tears the fixture down`                         | Skipped.                              |

### [`skipped-test/`](skipped-test/) · [`canonical.test.ts`](skipped-test/canonical.test.ts)

The two quieter ways it happens.

| Test                                       | Behavior                                                          |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `healthcheck always passes`                | Never fails, never skips.                                         |
| `always skipped never deleted`             | `it.skip`. Has not executed since somebody typed four characters. |
| `sometimes skipped by a runtime condition` | Skips 40% of runs. Partial history looks maintained.              |
| `never skipped`                            | The control.                                                      |

### [`new-test/`](new-test/) · [`canonical.test.ts`](new-test/canonical.test.ts)

| Test                                | Behavior                                                           |
| ----------------------------------- | ------------------------------------------------------------------ |
| `healthcheck always passes`         | Never fails.                                                       |
| `has been here since the beginning` | The control: emphatically not new.                                 |
| `first appeared on <date>` × 21     | One per day of a rolling window. All pass; the story is their age. |

### [`slow-test/`](slow-test/) · [`canonical.test.ts`](slow-test/canonical.test.ts)

| Test                                            | Behavior                                       |
| ----------------------------------------------- | ---------------------------------------------- |
| `healthcheck always passes`                     | Never fails, never slow.                       |
| `duration is stable`                            | The control. Flat duration.                    |
| `duration grows a little each day`              | Ramps over a 14-day cycle, then resets.        |
| `duration is usually fast but sometimes is not` | Bimodal: 10% of runs take eight times as long. |

### [`pass-on-retry/`](pass-on-retry/) · [`retry-ladder.spec.ts`](pass-on-retry/retry-ladder.spec.ts)

Playwright, three retries.

| Test                                            | Behavior                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| `passes on the first attempt`                   | The control. Never retried, so never pairs.         |
| `passes on the second attempt`                  | Fails once, then passes.                            |
| `passes on the third attempt`                   | Fails twice, then passes.                           |
| `passes on the fourth attempt`                  | Fails three times, then passes.                     |
| `never passes however many times it is retried` | Fails every attempt. **Not** a pair — the boundary. |

### [`pass-on-retry/`](pass-on-retry/) · [`canonical.test.ts`](pass-on-retry/canonical.test.ts)

Vitest, so the healthcheck cannot be retried.

| Test                        | Behavior     |
| --------------------------- | ------------ |
| `healthcheck always passes` | Never fails. |

### [`timeout-inflation/`](timeout-inflation/) · [`canonical.test.ts`](timeout-inflation/canonical.test.ts)

| Test                                     | Behavior                                                      |
| ---------------------------------------- | ------------------------------------------------------------- |
| `healthcheck always passes`              | Never fails, never blocks.                                    |
| `blocks on a timeout only when it fails` | ~150ms when it passes; blocks to a ~5s ceiling when it fails. |
| `fails fast when it fails`               | The control. Same failure rate, returns immediately.          |

## Related

- [`CLAUDE.md`](CLAUDE.md) — conventions for changing anything in here
- [`../README.md`](../README.md) — what this repo is, and the full monitor catalog
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — running these locally, tuning them, forking
