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

| Group                                         | Fails                         |
| --------------------------------------------- | ----------------------------- |
| `protected branch member 01` … `03`           | every `PB` run                |
| `pull request member 01` … `03`               | every `PR` run                |
| `merge queue member 01` … `03`                | every `MQ` run                |
| `protected branch sometimes member 01` … `03` | 10% of `PB` runs              |
| `pull request sometimes member 01` … `03`     | 10% of `PR` runs              |
| `merge queue sometimes member 01` … `03`      | 10% of `MQ` runs              |
| `fails on mondays`                            | every run on a Monday, UTC    |
| `fails every other day`                       | every run on alternating days |
| `healthcheck always passes`                   | never                         |

So a scheduled run on `main` produces 3–6 failures and a pull request another 3–6, from the same file,
both stepping up on Mondays and alternating days. The always-on groups are deterministic, which makes
them a clean input to a threshold; the 10% groups give it something to be noisy about.

`fails every other day` is anchored to the epoch day, not the day of the month — day-of-month parity
doubles up across a 31-day boundary.

Members are named by position rather than outcome, since positions cannot lie if the rate is tuned.

## Branch classification

[`utils`](../utils/) derives it from CI's environment: `MQ` for `trunk-merge/…` and
`gh-readonly-queue/…`, `PB` for `main`/`master`/`develop`/`release`, `PR` for everything else. A local
run is therefore a `PR` run; `GITHUB_REF_NAME=main pnpm test` exercises the others.

## What you should see

Within an hour, 3–6 failures on the protected-branch group from the scheduled run and a different set on
the factory's pull request. Within a day, a count that is visibly different per branch class, and a
threshold under three firing while one above six never does. The count steps up for a full day each
Monday.
