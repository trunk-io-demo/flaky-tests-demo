# `failure-count`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/failure-count-monitor>

## What this monitor detects

How many failures happened in a window, as an absolute number rather than a proportion.

A rate cannot tell **one** test failing half the time from **twelve** tests each failing half the
time. Both are 50%. Only the second one wakes somebody up.

## The story here

The count's size depends on where the run came from. Every run is exactly one of `PB`, `PR`, or `MQ`,
so exactly one always-on group fires — the aggregate swings with the branch class while no individual
test's rate changes.

| Group                                         | Fails                          |
| --------------------------------------------- | ------------------------------ |
| `protected branch member 01` … `03`           | Every `PB` run.                |
| `pull request member 01` … `03`               | Every `PR` run.                |
| `merge queue member 01` … `03`                | Every `MQ` run.                |
| `protected branch sometimes member 01` … `03` | 10% of `PB` runs.              |
| `pull request sometimes member 01` … `03`     | 10% of `PR` runs.              |
| `merge queue sometimes member 01` … `03`      | 10% of `MQ` runs.              |
| `fails on mondays`                            | Every run on a Monday, UTC.    |
| `fails every other day`                       | Every run on alternating days. |
| `healthcheck always passes`                   | Never.                         |

So a scheduled run on `main` produces 3–4 failures, a pull request 3–6, and both step up by one on
Mondays and on alternating days. The always-on groups are deterministic, which makes them a clean
input to a threshold; the 10% groups give it something to be noisy about.

`fails every other day` is anchored to the **epoch day**, not the day of the month — day-of-month
parity doubles up across a 31-day boundary.

Members are named by position rather than outcome: `protected branch member 01`, not
`always fails 01`. Positions cannot lie when somebody tunes the rate.

## Branch classification

[`utils`](../utils/) reads it from CI's environment:

| Class | Branch                                   |
| ----- | ---------------------------------------- |
| `MQ`  | `trunk-merge/…` or `gh-readonly-queue/…` |
| `PB`  | `main`, `master`, `develop`, `release`   |
| `PR`  | everything else                          |

Which means a local run is a `PR` run. To see the others fire:

```bash
GITHUB_REF_NAME=main pnpm test                       # PB
GITHUB_REF_NAME=trunk-merge/abc pnpm test            # MQ
```

## What you should see in the product

| When           | What                                                                                 |
| -------------- | ------------------------------------------------------------------------------------ |
| Within an hour | 3–4 failures from the scheduled run, all on the protected-branch group.              |
| Within an hour | A different 3–6 on the PR factory's pull request, from the same file.                |
| Within a day   | ~96 failures on the protected group, and a count visibly different per branch class. |
| Day 1          | A threshold under three fires; one above four never does, which is the useful half.  |
| Next Monday    | The count steps up for a full day, then back down.                                   |

## Configuration

| Variable                      | Default                       | Effect                                       |
| ----------------------------- | ----------------------------- | -------------------------------------------- |
| `MONITORS_FAILURE_COUNT_RATE` | 10                            | Rate for the three "sometimes" groups.       |
| `PROTECTED_BRANCHES`          | `main,master,develop,release` | Which branches count as `PB`. Exact matches. |

Group size is fixed at three in code — it is the count being demonstrated.
