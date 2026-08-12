# `skipped-test`

> [!NOTE]
> **Docs:** [Skipped test monitor](https://docs.trunk.io/flaky-tests/detection/skipped-test-monitor)

Tests that have stopped running without anybody deleting them. Either intentionally skipped or bypassed by the test reporter. Flags with a label for human intervention.

## Prototypical examples

The ones to open in a demo. The test column links to the source that generated the history.

| Test                                                            | Why this one                                                                        | Production                                                                                                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`sometimes skipped by a runtime condition`](canonical.test.ts) | Partial history from a runtime skip. Runs most of the time, so it looks maintained. | [history](https://app.trunk.io/flaky-tests-demo/flaky-tests/collections/oQbZIsKc/tests/31fd0870-eb39-48c0-b2a6-a3e3643e5f07_4b4239bd-7e50-5abb-93f3-4ff0c6c8e398?tab=history) |
| [`reconciles the audit log`](cascade.spec.ts)                   | Partial history from the cascade instead: skipped because a step above it failed.   | [history](https://app.trunk.io/flaky-tests-demo/flaky-tests/collections/oQbZIsKc/tests/31fd0870-eb39-48c0-b2a6-a3e3643e5f07_c422a18d-858b-538f-8d54-690d1b832b03?tab=history) |

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
