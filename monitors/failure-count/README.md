# `failure-count`

## What this monitor detects

How many failures happened in a window, as an absolute number rather than as a proportion.

That distinction is the entire reason this is a separate monitor from `failure-rate`. A rate cannot
tell the difference between **one** test failing half the time and **twelve** tests each failing
half the time. Both are 50%. Only the second one wakes somebody up.

## The story in this folder

[`canonical.test.ts`](canonical.test.ts) is a burst: thirteen tests, of which a configured number
fail on **every single run**.

| Test                                  | Behavior                                   |
| ------------------------------------- | ------------------------------------------ |
| `healthcheck_always_passes`           | Never fails.                               |
| `burst_member_01` … `burst_member_04` | Fail on every run — the count.             |
| `burst_member_05` … `burst_member_12` | Pass on every run — the rest of the suite. |

There are no draws and no rate here. The count is **deterministic**, which makes it the cleanest
possible input to a threshold: if the monitor is set to fire above three, it fires, every run,
forever, until somebody changes the variable.

### Why the members are named by position

`always_fails_03` would be a lie the moment somebody set `MONITORS_FAILURE_COUNT` to two — the test
would still be named always_fails and would sit there passing. The count is configuration, so the
names are neutral and the number lives here.

## What you should see in the product

| When           | What                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Within an hour | Four failures in one run, from four distinct tests in one suite.                                                                                                     |
| Within a day   | 96 failures across 24 runs, at exactly four per run.                                                                                                                 |
| Day 1          | A failure-count monitor with a threshold under four fires. One set above it never does, no matter how long you wait — which is the useful half of the demonstration. |

## Deliberate overlap with other monitors

- **[`failure-rate`](../failure-rate/README.md)** — the same runs are also a rate. Each burst member
  sits at 100% or 0%, so a rate monitor flags the same four tests but tells you nothing about how
  many there are. Reading the two side by side is the point.
- **[`new-test`](../new-test/README.md)** — every burst member is new exactly once.

## Configuration

| Variable                 | Default | Effect                                                               |
| ------------------------ | ------- | -------------------------------------------------------------------- |
| `MONITORS_FAILURE_COUNT` | 4       | How many of the twelve members fail. 0 turns the story off entirely. |

The suite size is fixed at twelve in code, not configurable. The count is what the monitor measures;
the denominator is only there to make the count look like part of a real suite rather than like the
whole thing failing.

## Links

- Up: [`docs/monitors.md`](../../docs/monitors.md)
- Up: [`docs/configuration.md`](../../docs/configuration.md)
- Sideways: [`failure-rate`](../failure-rate/README.md) — the same data, read as a proportion
