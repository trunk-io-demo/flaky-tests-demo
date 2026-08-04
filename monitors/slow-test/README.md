# `slow-test`

## What this monitor detects

Duration regressions: a test that still passes but takes materially longer than it used to.

Slowness is the failure mode nobody files a bug for. A suite does not become unusable in one commit
— it gains four seconds a week until somebody quietly stops running it locally, and then the tests
stop catching things because nobody runs them.

## The story in this folder

"Slow" is three different problems, so [`canonical.test.ts`](canonical.test.ts) has three tests.

| Test                                            | Shape                                                     |
| ----------------------------------------------- | --------------------------------------------------------- |
| `healthcheck_always_passes`                     | Never fails, never slow.                                  |
| `duration_is_stable`                            | The control. Same work every run, flat duration.          |
| `duration_grows_a_little_each_day`              | Ramps up by 120ms a day over a 14-day cycle, then resets. |
| `duration_is_usually_fast_but_sometimes_is_not` | Bimodal: 10% of runs take eight times as long.            |

The gradual one is the shape a real regression has, and the shape that a threshold on today's
duration misses — no single day's increase is remarkable. The bimodal one is the shape an **average**
misses: the mean barely moves while a tenth of runs are eight times slower, which is the version of
"slow" a developer actually experiences.

The control is what makes either legible. Without it, a platform-wide slowdown — a noisy runner, a
new image — is indistinguishable from the regression next door.

### The ramp resets on purpose

A ramp that never reset would eventually take minutes per run. Resetting also demonstrates the other
half of the monitor: a regression that gets fixed should **resolve**. The cycle position is derived
from the day number rather than from a start date, so it is computable from today alone — an
absolute anchor would rot as history ages out, and a fork created mid-cycle would disagree with the
original about what day of the ramp it is on.

## What you should see in the product

| When           | What                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Within an hour | Three durations: one flat, one at today's point on the ramp, one either fast or spiked.                             |
| Within a day   | The bimodal test's distribution is visibly two-humped.                                                              |
| Day 3–14       | The ramp is unmistakable, and a slow-test monitor fires on it.                                                      |
| Cycle rollover | The ramp resets and the detection resolves, which is the half of the monitor's behavior nobody usually gets to see. |

## Deliberate overlap with other monitors

- **[`timeout-inflation`](../timeout-inflation/README.md)** — read these two together. This folder is
  a test that genuinely got slower. That one is a test that did **not** get slower, and only looks
  like it because its failures block on a timeout. A slow-test monitor fires on both; only one of
  them is worth profiling.
- **[`skipped-test`](../skipped-test/README.md)** — a skipped test has no duration, which is not the
  same as being fast.

## Configuration

| Variable                     | Default | Effect                                                      |
| ---------------------------- | ------- | ----------------------------------------------------------- |
| `MONITORS_SLOW_BASE_MS`      | 150     | Baseline duration everything is measured against.           |
| `MONITORS_SLOW_GROWTH_MS`    | 120     | Milliseconds added per day of the ramp.                     |
| `MONITORS_SLOW_CYCLE_DAYS`   | 14      | Length of the ramp before it resets.                        |
| `MONITORS_SLOW_SPIKE_FACTOR` | 8       | How much slower a spiked run is, as a multiple of baseline. |

`GROWTH_MS × CYCLE_DAYS` is real wall clock on the last day of every cycle, on every run. At the
defaults that is a 1.8-second test at the peak, which is cheap. Raising both is the fastest way to
make this folder the most expensive thing in the hourly run.

## Links

- Up: [`docs/monitors.md`](../../docs/monitors.md)
- Up: [`docs/configuration.md`](../../docs/configuration.md)
- Sideways: [`timeout-inflation`](../timeout-inflation/README.md) — slowness that is not a slowdown
