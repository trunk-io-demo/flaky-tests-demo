# `skipped-test`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/skipped-test-monitor>

Tests that have stopped running without anybody deleting them. The quietest real problem a suite has: a
skipped test looks green, appears in no failure rate and no failure count, satisfies whoever asked for
coverage, and can sit there for a year.

## The story

**[`cascade.spec.ts`](cascade.spec.ts) is the canonical case.** A playwright serial group whose first test
fails, after which five tests report as skipped without anyone having decided they should. The suite shows
one failure and looks almost fine.

That is how the problem actually arrives. Nobody writes `test.skip` on nineteen tests — one setup step
breaks and the runner declines to attempt the rest, so a single failure hides an arbitrary amount of
coverage behind it.

The setup fails 60% of runs rather than all of them, so the five downstream steps have **partial**
history: mostly skipped, occasionally run, each at its own small rate. Partial history is the harder
signal — a test that runs sometimes looks maintained. Retries are off, since a retried test that
eventually passes is a pass-on-retry story and would give the cascade a second chance to not cascade.

[`canonical.test.ts`](canonical.test.ts) has the two quieter ways:

| Test                                       | Mechanism                                                   |
| ------------------------------------------ | ----------------------------------------------------------- |
| `always skipped never deleted`             | `it.skip`. The body still compiles and still passes review. |
| `sometimes skipped by a runtime condition` | Skips 40% of runs. Partial history looks _maintained_.      |
| `never skipped`                            | The control.                                                |

## What you should see

Five tests skipped on most runs and executed on the rest, one test always skipped, and one skipped
intermittently. The partial ones are the interesting shape: a history that is mostly absent hides in any
aggregate.
