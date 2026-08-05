# `failure-count`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/failure-count-monitor>

How many failures happened in a window, as an absolute number rather than a proportion. A rate cannot
tell **one** test failing half the time from **twelve** tests each failing half the time. Both are 50%,
but the second means twelve tests get classified flaky and quarantined — twelve tests' worth of coverage
removed rather than one.

## The story

The count's size depends on where the run came from. Every run is exactly one of `PB`, `PR`, or `MQ`, so
exactly one always-on group fires — the aggregate swings with the branch class while no individual
test's rate changes.

| Test                        | Fails                         |
| --------------------------- | ----------------------------- |
| `always fails PB`           | every `PB` run                |
| `sometimes fails PB 01…03`  | 10%, 20%, 30% of `PB` runs    |
| `always fails PR`           | every `PR` run                |
| `sometimes fails PR 01…03`  | 10%, 20%, 30% of `PR` runs    |
| `always fails MQ`           | every `MQ` run                |
| `sometimes fails MQ 01…03`  | 10%, 20%, 30% of `MQ` runs    |
| `fails on mondays`          | every run on a Monday, UTC    |
| `fails every other day`     | every run on alternating days |
| `healthcheck always passes` | never                         |

Each rung fails at its own rate, so no two are the same test twice over.

So a scheduled run on `main` produces 1–4 failures and a pull request 1–4, from the same file, both
stepping up on Mondays and alternating days. The always-fails tests are deterministic, which makes them a
clean input to a threshold; the ladders give it something to be noisy about.

`fails every other day` is anchored to the epoch day, not the day of the month — day-of-month parity
doubles up across a 31-day boundary.

## Branch classification

[`utils`](../utils/) derives it from CI's environment: `MQ` for `trunk-merge/…` and
`gh-readonly-queue/…`, `PB` for `main`/`master`/`develop`/`release`, `PR` for everything else. A local
run is therefore a `PR` run; `GITHUB_REF_NAME=main pnpm test` exercises the others.

## What you should see

Within an hour, one to four failures from the scheduled run and a different set on the factory's pull
request. Within a day, a count visibly different per branch class, and a threshold at one firing while one
above four does not. The count steps up for a full day each Monday.

## Other monitors

| Monitor                                       | How it overlaps                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`failure-rate`](../failure-rate/README.md)   | The same failures as a proportion. The always-fails tests sit at 100% and the ladders at 10–30%, so a rate monitor sees them all without seeing the count. |
| [`pass-on-retry`](../pass-on-retry/README.md) | The 20% and 30% rungs pair on the same commit across hourly uploads. The always-fails tests never do, since they never pass.                               |
| [`slow-test`](../slow-test/README.md)         | Nothing here varies its duration, so it is the control against which a duration story reads.                                                               |
| [`skipped-test`](../skipped-test/README.md)   | Its cascade contributes one failure while hiding five tests, so a count understates the blast radius by five.                                              |

Real flakiness trips several monitors at once, so these overlaps are the point rather than a smell.
