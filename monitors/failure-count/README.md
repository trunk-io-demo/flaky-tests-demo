# `failure-count`

> [!NOTE]
> **What this monitor does, in the product docs:**
> <https://docs.trunk.io/flaky-tests/detection/failure-count-monitor>
>
> [`monitors/README.md`](../README.md) indexes every monitor story and [`CLAUDE.md`](../CLAUDE.md) has the conventions for changing them. [`CONTRIBUTING.md`](../../CONTRIBUTING.md) has `MONITORS_FAILURE_COUNT_RATE` and `PROTECTED_BRANCHES`.
>
> Read this against [`failure-rate`](../failure-rate/README.md): the same failures as a proportion rather than a number.

## What this monitor detects

How many failures happened in a window, as an absolute number rather than a proportion.

That distinction is the whole reason it is a separate monitor. A rate cannot tell the difference
between **one** test failing half the time and **twelve** tests each failing half the time. Both are
50%. Only the second one wakes somebody up.

## The story in this folder

The count's **size depends on where the run came from**. Each group of three fails on exactly one
branch class, so a scheduled run against the protected branch produces a different count from a pull
request, from the same file, with every individual test's rate staying flat.

That is the thing a rate cannot express: the _aggregate_ moves with the branch class while no single
test's behavior changes.

| Group                                         | Fails                               |
| --------------------------------------------- | ----------------------------------- |
| `protected branch member 01` … `03`           | Every `PB` run.                     |
| `pull request member 01` … `03`               | Every `PR` run.                     |
| `merge queue member 01` … `03`                | Every `MQ` run.                     |
| `protected branch sometimes member 01` … `03` | 10% of `PB` runs.                   |
| `pull request sometimes member 01` … `03`     | 10% of `PR` runs.                   |
| `merge queue sometimes member 01` … `03`      | 10% of `MQ` runs.                   |
| `fails on mondays`                            | Every run on a Monday, UTC.         |
| `fails every other day`                       | Every run on alternating days, UTC. |
| `healthcheck always passes`                   | Never.                              |

### The counts this produces

| Run came from                      | Failures                             |
| ---------------------------------- | ------------------------------------ |
| Protected branch, ordinary day     | 3, plus 0–3 from the partial group   |
| Pull request, ordinary day         | 3, plus 0–3                          |
| Merge queue, ordinary day          | 3, plus 0–3                          |
| Any of the above, on a Monday      | +1                                   |
| Any of the above, alternating days | +1                                   |
| Neither — a local run, or `NONE`   | 0–1, from the date-driven tests only |

The always-on groups are deterministic, which makes them the cleanest possible input to a threshold:
set one above three and it never fires no matter how long you wait. The 10% groups sit on top and
give the count something to be noisy about, which is what makes a threshold worth tuning rather than
obvious.

### The two on a calendar

`fails on mondays` fails on **every run of that day** — 24 failures in a row, then six days of
nothing. A weekly spike no rate threshold describes well.

`fails every other day` alternates, anchored to the **epoch day** rather than the day of the month.
Day-of-month parity doubles up across a 31-day boundary; epoch-day parity never does.

### Where the branch class comes from

[`utils`](../utils/) reads it from CI's own environment and reproduces the uploader's precedence, so a
test that branches on `getBranchClass()` behaves the way the product will classify the run. The order
matters: a merge-queue branch is `MQ` even when a PR number is also set.

Running locally you are on neither, so the class is `NONE` and only the date-driven tests can fail.
To see a group fire:

```bash
GITHUB_REF_NAME=main pnpm test                                    # PB
GITHUB_HEAD_REF=feature/x GITHUB_REF=refs/pull/42/merge pnpm test  # PR
GITHUB_REF_NAME=gh-readonly-queue/main/abc pnpm test               # MQ
```

### Members are named by position

`protected branch member 01`, not `always fails 01`. Positions cannot lie when somebody tunes the
rate; outcomes can.

## What you should see in the product

| When           | What                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Within an hour | Three or four failures from a scheduled run, all on the protected-branch group.                                                     |
| Within an hour | A different three or four on the PR factory's pull request, from the same file.                                                     |
| Within a day   | ~96 failures on the protected group across 24 runs, and a count that is visibly different per branch class.                         |
| Day 1          | A failure-count monitor with a threshold under three fires. One above four does not, which is the useful half of the demonstration. |
| Next Monday    | The count steps up by one for a full day, then back down.                                                                           |

## Configuration

| Variable                      | Default | Effect                                                                          |
| ----------------------------- | ------- | ------------------------------------------------------------------------------- |
| `MONITORS_FAILURE_COUNT_RATE` | 10      | Rate for the three "sometimes" groups. The always-on groups are 100% by design. |
| `PROTECTED_BRANCHES`          | `main`  | Which branches count as `PB`. Matched exactly, not by glob.                     |

Group size is fixed at three in code. It is the count being demonstrated, so it is not something a
fork should tune without deciding it wants a different demonstration.
