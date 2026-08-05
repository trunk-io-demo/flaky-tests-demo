# `skipped-test`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/skipped-test-monitor>

Tests that have stopped running without anybody deleting them. The quietest real problem a suite has: a
skipped test looks green, appears in no failure rate and no failure count, satisfies whoever asked for
coverage, and can sit there for a year.

## The story

**[`cascade.spec.ts`](cascade.spec.ts) is the canonical case.** A playwright serial group whose first
test fails, after which five tests report as skipped without anyone having decided they should. The suite
shows one failure and looks almost fine.

That is how the problem actually arrives. Nobody writes `test.skip` on nineteen tests — one setup step
breaks and the runner declines to attempt the rest, so a single failure hides an arbitrary amount of
coverage behind it. Retries are off here: a retried test that eventually passes is a pass-on-retry story,
and it would give the cascade a second chance to not cascade.

[`canonical.test.ts`](canonical.test.ts) has the two quieter ways:

| Test                                       | Mechanism                                                   |
| ------------------------------------------ | ----------------------------------------------------------- |
| `always skipped never deleted`             | `it.skip`. The body still compiles and still passes review. |
| `sometimes skipped by a runtime condition` | Skips 40% of runs. Partial history looks _maintained_.      |
| `never skipped`                            | The control.                                                |

## What you should see

Five tests reporting as skipped every run from the cascade, one always, one intermittently. The
intermittent one is the interesting shape: 40% skipped and 60% passing hides in any aggregate.
