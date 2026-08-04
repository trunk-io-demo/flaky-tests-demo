# The monitor catalog

One entry per monitor: what it detects, which story in this repo demonstrates it, and what you
should expect to see. Each entry links down into the story's own README, and each of those links
back here.

_Entries are filled in as each story lands. A monitor with no entry has no story yet._

## Monitors

| Monitor             | Detects | Story | Status  |
| ------------------- | ------- | ----- | ------- |
| `failure-rate`      |         |       | pending |
| `failure-count`     |         |       | pending |
| `skipped-test`      |         |       | pending |
| `new-test`          |         |       | pending |
| `slow-test`         |         |       | pending |
| `pass-on-retry`     |         |       | pending |
| `timeout-inflation` |         |       | pending |

## Stories that trip more than one monitor

The most compelling demos trip two or three monitors at once, because real flakiness does. This
section records the deliberate overlaps so that a reader who lands on one story finds the others.

_Populated as the stories land._

## Synthetic stories

`synth/` demonstrates the arcs that no live test can produce inside a demo — a 30-day test
lifecycle, a per-branch failure rate, a macOS-only failure.

| Capability | Demonstrates | Story |
| ---------- | ------------ | ----- |

## Related

- [`configuration.md`](configuration.md) — tuning any story's rate or scale
- [`operations.md`](operations.md) — the evaluation windows that decide when a monitor can fire
