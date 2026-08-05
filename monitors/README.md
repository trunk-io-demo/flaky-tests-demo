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

[`utils/`](utils/) is not a monitor: it holds the helpers the stories share — branch class, UTC dates,
seeded randomness, and the runner's OS — and has no tests of its own.
