# `slow-test`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/slow-test-monitor>

Duration regressions: a test that still passes but takes materially longer than it used to. Slowness is
the failure mode nobody files a bug for — a suite gains four seconds a week until people stop running it
locally, and then it stops catching things.

## The story

"Slow" is three problems, so there are three tests.

| Test                                            | Shape                                             |
| ----------------------------------------------- | ------------------------------------------------- |
| `duration is stable`                            | The control. Flat.                                |
| `duration grows a little each day`              | Ramps 120ms/day over a 14-day cycle, then resets. |
| `duration is usually fast but sometimes is not` | Bimodal: 10% of runs take eight times as long.    |

The ramp is the shape a threshold on today's duration misses — no single day's increase is remarkable.
The bimodal one is the shape an average misses: the mean barely moves while a tenth of runs are eight
times slower, which is the version of slow a developer actually experiences. The control is what makes
either legible; without it a noisy runner is indistinguishable from the regression next door.

The ramp resets each cycle, partly for cost and partly because it demonstrates the other half of the
monitor: a regression that gets fixed should resolve. Cycle position comes from the epoch day, so it is
computable from today alone.

## What you should see

The bimodal distribution is visible within a day. The ramp is unmistakable by day three, and resolves at
the cycle rollover — which is behavior nobody usually gets to watch.
