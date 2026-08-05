# The monitor catalog

One entry per monitor: what it detects, which story in this repo demonstrates it, and what you
should expect to see. Each entry links down into the story's own README, and each of those links
back here.

All seven monitors have a story. Every entry links down to that story's README, and each of those links back here.

## Monitors

| Monitor             | Detects                                                        | Story                                                                                                                 |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `failure-rate`      | What fraction of a test's recent runs failed.                  | [`monitors/failure-rate`](../monitors/failure-rate/README.md) — three tests differing only in their rate              |
| `failure-count`     | How many failures in a window, as an absolute number.          | [`monitors/failure-count`](../monitors/failure-count/README.md) — four of twelve tests fail every run                 |
| `skipped-test`      | Tests that stopped running without being deleted.              | [`monitors/skipped-test`](../monitors/skipped-test/README.md) — always, sometimes, and never skipped                  |
| `new-test`          | Tests too young to be judged on the same terms as the rest.    | [`monitors/new-test`](../monitors/new-test/README.md) — one genuinely new test per day                                |
| `slow-test`         | Duration regressions.                                          | [`monitors/slow-test`](../monitors/slow-test/README.md) — a gradual ramp, a bimodal spike, a flat control             |
| `pass-on-retry`     | A test that failed and then passed on the same commit.         | [`monitors/pass-on-retry`](../monitors/pass-on-retry/README.md) — a retry ladder in one upload                        |
| `timeout-inflation` | A test that did not get slower, only got slower when it fails. | [`monitors/timeout-inflation`](../monitors/timeout-inflation/README.md) — a real timeout race vs. a fail-fast control |

## Stories that trip more than one monitor

The most compelling demos trip two or three monitors at once, because real flakiness does. This
section records the deliberate overlaps so that a reader who lands on one story finds the others.

| Story                                                         | Also trips                  | Why                                                                                              |
| ------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| [`monitors/failure-rate`](../monitors/failure-rate/README.md) | `failure-count`, `new-test` | Three tests failing in one run is a count as well as a rate, and every test is new exactly once. |

## Live scenarios

`apps/` produces the failure shapes that cannot be fabricated convincingly, using real tests against
surfaces that genuinely misbehave.

| Scenario              | Demonstrates                                                                                                         | Story                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Parking meter         | A periodic, predictable pattern no percentage-based rate can imitate — and one an aggregate actively misleads about. | [`apps/parking-meter`](../apps/parking-meter/README.md)       |
| Mass detection event  | Alert **volume** and grouping rather than single detections. Twenty tests fail together, one day a month.            | [`apps/mass-detection`](../apps/mass-detection/README.md)     |
| Third-party API calls | Failures that cluster in time and **correlate across tests**, recovering together when a shared budget resets.       | [`apps/third-party-apis`](../apps/third-party-apis/README.md) |
| GitHub uptime         | A real external dependency causing real intermittency.                                                               | [`apps/github-uptime`](../apps/github-uptime/README.md)       |

⚠️ Three of those fail on somebody else's schedule or somebody else's behalf. Each one's README says
how to tell "the monitor worked" from "we have a problem" in one lookup, and
[`operations.md`](operations.md) lists them together.

## Synthetic stories

`synth/` demonstrates the arcs that no live test can produce inside a demo — a 30-day test
lifecycle, a per-branch failure rate, a macOS-only failure.

| Capability               | Demonstrates                                                                                         | Story                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Long-lived dated cohort  | A test's full lifecycle: new, then established, then gone. Crosses the new-test window.              | [`synth/cohorts`](../synth/cohorts/README.md)             |
| Short-lived dated cohort | A test that dies before the new-test window elapses, so it is never not-new. Resolution by absence.  | [`synth/cohorts`](../synth/cohorts/README.md)             |
| Failure rate per branch  | Branch-filtered monitor configuration, including `release/*` vs `release/?.?.?` vs `release/*.beta`. | [`synth/branch-rates`](../synth/branch-rates/README.md)   |
| Failure rate per variant | "Only flaky on macOS", emitted from a Linux runner so it costs no macOS minutes.                     | [`synth/variant-rates`](../synth/variant-rates/README.md) |

## Related

- [`configuration.md`](configuration.md) — tuning any story's rate or scale
- [`operations.md`](operations.md) — the evaluation windows that decide when a monitor can fire
