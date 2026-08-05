# `timeout-inflation`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/timeout-inflation-monitor>

A test that **did not get slower** — it only got slower _when it fails_, because it is blocking on a
timeout.

A test waiting on something that is not coming does not fail fast. It waits out its timeout, so its
failures all take almost exactly the ceiling while its passes are unaffected:

```text
  passes:   ▁▂▃▂▁                    ~150ms, tight
  failures:                   ▁█▁    ~5000ms, at the ceiling
```

Every aggregate misses this. The mean barely moves while the failure rate is low. A slow-test monitor
sees p95 climb and sends somebody to profile code that did not change. A failure-rate monitor sees the
failures but not why. The inflation is the _diagnosis_: go look at what it is waiting for.

## The story

`blocks on a timeout only when it fails` races the work against a timer, which is how the real bug is
written — on a failing run the work is a promise that never resolves, so the duration is a consequence
of the timeout rather than a number chosen to look like one.

`fails fast when it fails` is the control: same failure rate, returns immediately. Side by side, the
inflation is obviously a property of _how_ it fails.

Naive randomness cannot produce this. Drawing duration and outcome independently gives failures the same
distribution as passes, which is exactly what is not happening in a real timeout — so durations are
pinned per outcome and only a few percent of jitter is drawn. Zero jitter would make every failure
byte-identical, which reads as generated.

## What you should see

About 5 failures out of 24 for each test per day. The inflating one's failures cluster tightly at 5s
while its passes cluster at 150ms; the control's failures are instant. A timeout-inflation monitor fires
on the first and not the second, while a slow-test monitor cannot tell them apart.

Cost: roughly 1s of wall clock per run on average, 5s on a failing one.

## Other monitors

| Monitor                                       | How it overlaps                                                                                                                                                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`slow-test`](../slow-test/README.md)         | **The pairing worth reading.** A slow-test monitor fires here too — p95 climbs as failures pile up at the ceiling — and it is wrong: nothing got slower. That folder holds a test that genuinely did. The discriminator is whether duration varies by _time_ or by _outcome_. |
| [`pass-on-retry`](../pass-on-retry/README.md) | A timeout that succeeds on a second go is the classic pair, and it is the one whose two halves have wildly different durations — milliseconds against the ceiling. Across hourly uploads on one commit, the story here pairs the same way.                                    |
| [`failure-rate`](../failure-rate/README.md)   | Both tests here sit at the same rate, so a rate monitor treats them identically. That is exactly why the rate is not enough.                                                                                                                                                  |

Real flakiness trips several monitors at once, so these overlaps are the point rather than a smell.
