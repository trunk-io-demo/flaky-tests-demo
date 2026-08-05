# `skipped-test`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/skipped-test-monitor>

Tests that have stopped running without anybody deleting them. Either intentionally skipped or bypassed by the test reporter. Flags with a label for human intervention.

## The story

**[`cascade.spec.ts`](cascade.spec.ts) is the canonical case.** A playwright serial group whose first test
fails, after which five tests report as skipped without anyone having decided they should. The suite shows
one failure and looks almost fine.

The setup fails 60% of runs rather than all of them, so the five downstream steps have **partial**
history: mostly skipped, occasionally run, each at its own small rate. And when the setup does pass, the
break point moves — a serial group stops at whichever test fails first, so a downstream step failing at
its own 2–10% skips only the steps behind _it_. Observed: setup passed, `reindexes after the update`
failed, and the two after it were skipped. Partial history is the harder
signal — a test that runs sometimes looks maintained. Retries are off, since a retried test that
eventually passes is a pass-on-retry story and would give the cascade a second chance to not cascade.

[`canonical.test.ts`](canonical.test.ts) has the two quieter ways:

| Test                                       | Mechanism                                                   |
| ------------------------------------------ | ----------------------------------------------------------- |
| `always skipped never deleted`             | `it.skip`. The body still compiles and still passes review. |
| `sometimes skipped by a runtime condition` | Skips 40% of runs. Partial history looks _maintained_.      |

`healthcheck always passes` is the control here: it never fails and never skips.

## What you should see

Five tests skipped on most runs and executed on the rest, one test always skipped, and one skipped
intermittently. The partial ones are the interesting shape: a history that is mostly absent hides in any
aggregate.

## Other monitors

| Monitor                                       | How it overlaps                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`slow-test`](../slow-test/README.md)         | A skipped test has no duration at all, which is not the same as being fast. A duration monitor that fails to exclude skips reports a suite getting faster as it stops running. |
| [`failure-count`](../failure-count/README.md) | The cascade contributes **one** failure while hiding five tests, so the count understates the blast radius by five.                                                            |
| [`new-test`](../new-test/README.md)           | Two kinds of absence: this one reports and says it did not run; a retiring cohort stops reporting entirely.                                                                    |
| [`pass-on-retry`](../pass-on-retry/README.md) | Retries are off here on purpose. With them on, the cascade's setup would get a second chance not to cascade and would pair instead.                                            |

Real flakiness trips several monitors at once, so these overlaps are the point rather than a smell.
