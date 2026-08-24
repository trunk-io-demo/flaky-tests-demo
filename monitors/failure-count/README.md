# `failure-count`

> [!NOTE]
> **Docs:** [Failure count monitor](https://docs.trunk.io/flaky-tests/detection/failure-count-monitor)

How many failures happened in a window, as an absolute number rather than a proportion. A rate cannot
tell **one** test failing half the time from **twelve** tests each failing half the time. Both are 50%,
but the second means twelve tests get classified flaky and quarantined — twelve tests' worth of coverage
removed rather than one.

## Prototypical examples

| Test                                                 | Why this one                                                                                              | Production                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`fails every other day`](canonical.test.ts)         | Fully deterministic, on a cadence you can check against a timestamp. A count with a square wave under it. | [monitors](https://app.trunk.io/flaky-tests-demo/flaky-tests/collections/oQbZIsKc/tests/31fd0870-eb39-48c0-b2a6-a3e3643e5f07_62ede8c1-2f6e-5f2f-9b1f-233c5a493f18?tab=monitors) |
| [`sometimes fails PB 10 percent`](canonical.test.ts) | The bottom rung, and branch-scoped: it can only contribute on a protected-branch run.                     | [monitors](https://app.trunk.io/flaky-tests-demo/flaky-tests/collections/oQbZIsKc/tests/31fd0870-eb39-48c0-b2a6-a3e3643e5f07_af897384-2418-5387-8aca-523b88c11eca?tab=monitors) |

## The story

The count's size depends on where the run came from. Every run is exactly one of `PB`, `PR`, or `MQ`, so
exactly one always-fails test and one ladder fire — the aggregate swings with the branch class while no individual
test's rate changes.

| Test                                           | Fails                         |
| ---------------------------------------------- | ----------------------------- |
| `always fails PB`                              | every `PB` run                |
| `sometimes fails PB 10 percent` … `30 percent` | 10%, 20%, 30% of `PB` runs    |
| `always fails PR`                              | every `PR` run                |
| `sometimes fails PR 10 percent` … `30 percent` | 10%, 20%, 30% of `PR` runs    |
| `always fails MQ`                              | every `MQ` run                |
| `sometimes fails MQ 10 percent` … `30 percent` | 10%, 20%, 30% of `MQ` runs    |
| `fails on mondays`                             | every run on a Monday, UTC    |
| `fails every other day`                        | every run on alternating days |
| `healthcheck always passes`                    | never                         |

Each rung fails at its own rate, so no two are the same test twice over.

So a scheduled run on `main` produces 1–6 failures and a pull request 1–6, from the same file: one
always-fails, nought to three from the ladder, and one each for Monday and the alternating day. The always-fails tests are deterministic, which makes them a
clean input to a threshold; the ladders give it something to be noisy about.

`fails every other day` is anchored to the epoch day, not the day of the month — day-of-month parity
doubles up across a 31-day boundary.

## Branch classification

[`utils`](../utils/) derives it from CI's environment: `MQ` for `trunk-merge/…` and
`gh-readonly-queue/…`, `PB` for `main`/`master`/`develop`/`release`, `PR` for everything else. A local
run is therefore a `PR` run, and `GITHUB_REF_NAME=main pnpm test` exercises `PB`. `MQ` comes from the merge
queue's testing branches, which only CI produces.

## What you should see

Within an hour, one to six failures from the scheduled run, a different set on the factory's pull request,
and a third from the merge queue's testing branch. Within a day, a count visibly different per branch class, and a threshold at one firing while one
above six does not. The count steps up for a full day each Monday.

## Other monitors

| Monitor                                       | How it overlaps                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`failure-rate`](../failure-rate/README.md)   | The same failures as a proportion. The always-fails tests sit at 100% and the ladders at 10–30%, so a rate monitor sees them all without seeing the count. |
| [`pass-on-retry`](../pass-on-retry/README.md) | The 20% and 30% rungs pair on the same commit across hourly uploads. The always-fails tests never do, since they never pass.                               |
| [`slow-test`](../slow-test/README.md)         | Nothing here varies its duration, so it is the control against which a duration story reads.                                                               |
| [`skipped-test`](../skipped-test/README.md)   | Its cascade contributes one failure while hiding five tests, so a count understates the blast radius by five.                                              |

Real flakiness trips several monitors at once, so these overlaps are the point rather than a smell.
