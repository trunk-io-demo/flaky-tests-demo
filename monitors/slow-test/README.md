# `slow-test`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/slow-test-monitor>

Duration regressions: a test that still passes but takes long enough to be flagged. Slowness can build up over time. Slowness monitors capture latency regressions and inter-test harness slowness.

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

## Contention, in a second file

[`contention.test.ts`](contention.test.ts) is a different cause of the same symptom. Four tests run
**concurrently** — `it.concurrent` — and take turns on one shared resource through a real ticket lock over
real shared state. Each waits out everyone ahead of it, so the last one spends two to three times longer
waiting than doing its own work.

How long each holds the resource is jittered per hour, so the queue costs a different amount every hour
and a test's duration drifts with no code change behind it. That is the part worth seeing: a duration that
moves for reasons outside the test.

| Test                                                             | Holds it for | Actual duration |
| ---------------------------------------------------------------- | ------------ | --------------- |
| `waits its turn on the shared fixture, holding it about 700 ms`  | ~700ms       | 0.5–0.9s        |
| `waits its turn on the shared fixture, holding it about 1400 ms` | ~1.4s        | 1.4–2.7s        |
| `waits its turn on the shared fixture, holding it about 2100 ms` | ~2.1s        | 2.9–5.5s        |
| `waits its turn on the shared fixture, holding it about 2800 ms` | ~2.8s        | 4.9–8.6s        |

The spread is the whole point: the tail does 2.8 seconds of work and takes up to 8.6, and which end of
that range it lands on depends on nothing it controls. Measured across 56 hour buckets, the fastest test
runs in 491ms and the slowest in 8564ms.

Each test carries a 60-second timeout, because vitest's 5-second default would kill the tail.

If contention ever stops resolving the test fails outright, because a wait that never ends is a deadlock
rather than slowness.

**This is the most expensive story in the repo**: around 7 seconds of wall clock every run, paid hourly.
Lower `HOLD_STEP_MS` to make it cheaper — the shape survives at any scale, it is just less dramatic.

## Other monitors

| Monitor                                               | How it overlaps                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`timeout-inflation`](../timeout-inflation/README.md) | **The pairing worth reading.** A slow-test monitor fires on that story too, because its p95 climbs as failures pile up at the ceiling — but nothing there got slower. Only one of the two is worth profiling. The discriminator: here the duration varies by _time_, there it varies by _outcome_. |
| [`skipped-test`](../skipped-test/README.md)           | A skipped test has no duration, so a duration monitor must exclude skips or read a suite that stopped running as one that got faster.                                                                                                                                                              |
| [`failure-rate`](../failure-rate/README.md)           | Every test here passes. A duration regression is invisible to a monitor that only asks whether tests fail.                                                                                                                                                                                         |
| [`failure-count`](../failure-count/README.md)         | Nothing there varies its duration, so that folder is the flat baseline these durations read against.                                                                                                                                                                                               |

Real flakiness trips several monitors at once, so these overlaps are the point rather than a smell.
