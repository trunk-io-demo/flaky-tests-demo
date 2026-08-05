# `timeout-inflation`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/timeout-inflation-monitor>

## What this monitor detects

A test that **did not get slower** — it only got slower _when it fails_, because it is blocking on a
timeout.

This is the sharpest signal in the repo, so it is worth being precise about the data.

A test waiting on something that is not coming does not fail fast. It waits out its timeout and then
fails, which means its failures all take almost exactly the same amount of time: the ceiling. Its
passes are unaffected — they still return as soon as the thing arrives.

So the signature is a **bimodal duration distribution split by outcome**:

```text
  passes:   ▁▂▃▂▁                    ~150ms, tight
  failures:                   ▁█▁    ~5000ms, pinned at the ceiling
```

Every aggregate misses this:

- **Mean duration** barely moves while the failure rate is low.
- **A slow-test monitor** sees p95 climb and blames the test for getting slower, sending somebody to
  profile code that did not change.
- **A failure-rate monitor** sees the failures but says nothing about why, and a 20% failure rate
  rarely gets prioritized on its own.

The inflation is the **diagnosis**. It says "this is a timeout, go look at what it is waiting for,"
which is a completely different investigation from either of the above.

## The story in this folder

| Test                                     | Behavior                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `healthcheck_always_passes`              | Never fails, never blocks.                                                                            |
| `blocks_on_a_timeout_only_when_it_fails` | Returns in ~150ms when the response arrives; blocks to a ~5s ceiling and then fails when it does not. |
| `fails_fast_when_it_fails`               | The control. Fails at the **same rate** and returns immediately.                                      |

The control is what makes the story legible. Both tests fail as often as each other; only one takes
the ceiling to do it. Side by side, the inflation is obviously a property of _how_ the test fails
rather than of the failure itself.

### The failure is a real timeout, not a sleep

[`canonical.test.ts`](canonical.test.ts) races the work against a timer, which is how the real bug is
written. On a failing run the work is a promise that never resolves — what a request to something
that has stopped answering looks like — and the duration is a **consequence** of the timeout rather
than a number chosen to look like one.

### Why naive randomness cannot produce this

Drawing a duration from one range and an outcome independently gives failures the same duration
distribution as passes. That is precisely the thing that is _not_ happening in a real timeout, and it
is the reason a generic flaky-test generator cannot demonstrate this monitor. The durations here are
pinned per outcome, with only a few percent of jitter drawn — real timeouts are not perfectly precise,
and zero jitter would make every failure byte-identical, which reads as generated.

## What you should see in the product

| When           | What                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Within an hour | One run of each. If it was a failing hour, one duration around 5s and one around 1ms.                                                   |
| Within a day   | ~5 failures out of 24 for each test. The inflating one's failure durations cluster tightly at the ceiling; its passes cluster at 150ms. |
| Day 1–2        | A timeout-inflation monitor fires on the first and not on the second, while a slow-test monitor cannot tell them apart.                 |

## Deliberate overlap with other monitors

- **[`slow-test`](../slow-test/README.md)** — read these two together. That folder is a test that
  genuinely got slower. This one is a test that did not. A slow-test monitor fires on both; only one
  of them is worth profiling. This is the most useful pairing in the repo.
- **[`failure-rate`](../failure-rate/README.md)** — both tests here sit at the same rate, so a rate
  monitor treats them identically. Which is exactly why the rate is not enough.

## Configuration

| Variable                          | Default | Effect                                                     |
| --------------------------------- | ------- | ---------------------------------------------------------- |
| `MONITORS_TIMEOUT_PASS_MS`        | 150     | What a healthy pass costs.                                 |
| `MONITORS_TIMEOUT_CEILING_MS`     | 5000    | The ceiling a failing run blocks against.                  |
| `MONITORS_TIMEOUT_JITTER_PERCENT` | 3       | Jitter on the ceiling. Zero makes every failure identical. |
| `MONITORS_TIMEOUT_FAILURE_RATE`   | 20      | How often the thing being waited on fails to arrive.       |

`CEILING_MS × FAILURE_RATE` is the real cost: at the defaults, about one second of wall clock per run
on average, and five seconds on a failing one. Raising the ceiling is the honest way to make the
bimodality more dramatic, and it is paid for in runner minutes on every failing run.

Keep the ceiling well under the vitest timeout, which is set to ceiling + 10s in the test. If vitest
kills the test first it reports **its** timeout instead, pinning the duration at vitest's limit rather
than at the one the story is about — and the story quietly becomes about the wrong number.
