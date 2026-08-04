# The monitor catalog

One entry per monitor: what it detects, which story in this repo demonstrates it, and what you
should expect to see. Each entry links down into the story's own README, and each of those links
back here.

_Entries are filled in as each story lands. A monitor with no entry has no story yet._

## Monitors

| Monitor             | Detects                                       | Story                                                                                                    | Status  |
| ------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| `failure-rate`      | What fraction of a test's recent runs failed. | [`monitors/failure-rate`](../monitors/failure-rate/README.md) — three tests differing only in their rate | landed  |
| `failure-count`     |                                               |                                                                                                          | pending |
| `skipped-test`      |                                               |                                                                                                          | pending |
| `new-test`          |                                               |                                                                                                          | pending |
| `slow-test`         |                                               |                                                                                                          | pending |
| `pass-on-retry`     |                                               |                                                                                                          | pending |
| `timeout-inflation` |                                               |                                                                                                          | pending |

## Stories that trip more than one monitor

The most compelling demos trip two or three monitors at once, because real flakiness does. This
section records the deliberate overlaps so that a reader who lands on one story finds the others.

| Story                                                         | Also trips                  | Why                                                                                              |
| ------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| [`monitors/failure-rate`](../monitors/failure-rate/README.md) | `failure-count`, `new-test` | Three tests failing in one run is a count as well as a rate, and every test is new exactly once. |

## Synthetic stories

`synth/` demonstrates the arcs that no live test can produce inside a demo — a 30-day test
lifecycle, a per-branch failure rate, a macOS-only failure.

| Capability               | Demonstrates                                                                                         | Story                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Long-lived dated cohort  | A test's full lifecycle: new, then established, then gone. Crosses the new-test window.              | [`synth/cohorts`](../synth/cohorts/README.md)           |
| Short-lived dated cohort | A test that dies before the new-test window elapses, so it is never not-new. Resolution by absence.  | [`synth/cohorts`](../synth/cohorts/README.md)           |
| Failure rate per branch  | Branch-filtered monitor configuration, including `release/*` vs `release/?.?.?` vs `release/*.beta`. | [`synth/branch-rates`](../synth/branch-rates/README.md) |
| Failure rate per variant | "Only flaky on macOS", emitted from a Linux runner.                                                  | pending                                                 |

## Related

- [`configuration.md`](configuration.md) — tuning any story's rate or scale
- [`operations.md`](operations.md) — the evaluation windows that decide when a monitor can fire
