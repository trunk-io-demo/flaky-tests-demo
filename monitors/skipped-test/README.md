# `skipped-test`

## What this monitor detects

Tests that have stopped running without anybody deleting them.

This is the quietest real problem a test suite has. A skipped test **looks green**. It appears in no
failure rate and no failure count, it satisfies whoever asked for coverage, and it can sit there for
a year — usually next to a comment saying it will be re-enabled next sprint. Nothing else in a CI
pipeline notices.

## The story in this folder

[`canonical.test.ts`](canonical.test.ts) has the three ways it happens.

| Test                                       | Mechanism                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `healthcheck_always_passes`                | Never fails and never skips.                                                                                       |
| `always_skipped_never_deleted`             | `it.skip`. The body still compiles, still passes review, and has not executed since someone typed four characters. |
| `sometimes_skipped_by_a_runtime_condition` | Skips at runtime on a configured percentage of runs.                                                               |
| `never_skipped`                            | The control. Runs every time.                                                                                      |

The second one is the interesting case. A test guarded by an environment check, a feature flag, or a
platform test is _usually_ running, so nobody notices the runs where it was not. It has **partial**
history, which is worse than none: it looks maintained.

## What you should see in the product

| When           | What                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Within an hour | One test reporting as skipped every run, one reporting as skipped sometimes.                                                          |
| Within a day   | `sometimes_skipped_by_a_runtime_condition` has around 40% of its runs skipped and 60% passing — the shape that hides in an aggregate. |
| Day 1          | A skipped-test monitor flags both, and `never_skipped` and the healthcheck confirm the suite itself is fine.                          |

## Deliberate overlap with other monitors

- **[`slow-test`](../slow-test/README.md)** — a skipped test has no duration at all, which is a
  different thing from being fast. Duration-based monitors have to exclude skips or they report a
  suite getting faster as it stops running.
- **[`synth/cohorts`](../../synth/cohorts/README.md)** — a retired cohort also stops producing runs,
  but by disappearing rather than by reporting a skip. Two different absences, resolved differently.

## Configuration

| Variable             | Default | Effect                                                               |
| -------------------- | ------- | -------------------------------------------------------------------- |
| `MONITORS_SKIP_RATE` | 40      | Percentage of runs `sometimes_skipped_by_a_runtime_condition` skips. |

Keep it well away from 0 and 100. At either end the test stops being the interesting case and
becomes a duplicate of one of its neighbours.

## Links

- Up: [`docs/monitors.md`](../../docs/monitors.md)
- Up: [`docs/configuration.md`](../../docs/configuration.md)
- Sideways: [`slow-test`](../slow-test/README.md) — the other monitor that has to reason about tests
  which did not run
