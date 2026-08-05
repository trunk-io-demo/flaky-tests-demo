# `failure-rate`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/failure-rate-monitor>

What percentage of a test's recent runs failed. The monitor most teams turn on first, and the one most
likely to be too noisy or too quiet depending on where the threshold lands.

## The story

A ladder in steps of ten, so a threshold set anywhere lands between two named tests and you can read off
which side each falls on.

| Test                                               | Fails                                   |
| -------------------------------------------------- | --------------------------------------- |
| `healthcheck always passes`                        | never                                   |
| `fails 10 percent` … `fails 100 percent`           | 10%, 20%, … 100% of runs                |
| `fails 40 percent on prs and 20 percent elsewhere` | 40% on `PR` runs, 20% on `PB` and `MQ`  |
| `fails 80 percent on prs and 40 percent elsewhere` | 80% on `PR` runs, 40% on `PB` and `MQ`  |
| `fails at a rate that climbs through the week`     | 10% on Sunday rising to 70% on Saturday |

The rates are in the names because they are constants in the test file — nothing outside it can make
them lie.

The last three add a second variable to the ladder's one. The stepped pair is what a branch-filtered
threshold reads differently depending on scope: the same test is twice as noisy on pull requests as on
the protected branch. The weekday one is a rate that is genuinely not stationary, which is the case an
average over the last N runs describes worst.

Outcomes are seeded on the test name and the current UTC hour, so a run differs from the last one and
still reproduces exactly in a fork. Every failure message prints the rate it used.

## What you should see

A single run says nothing — 10% and 20% are indistinguishable in one sample. After a day of hourly runs
the ladder separates cleanly, and a threshold anywhere in it fires on the rungs above and stays silent on
the ones below. `fails 100 percent` fails every run, and is the one rung that needs no history at all.

Over a week, the weekday test's rate is visibly a function of the day rather than a constant.

## This also feeds pass-on-retry

Scheduled runs report against the same head commit hour after hour, so any test here that fails one hour
and passes the next has failed and passed on the same commit — a
[pass-on-retry](../pass-on-retry/README.md) pair, formed by accident rather than by design. The higher
rungs pair most often.

That overlap is worth knowing rather than removing: real flakiness trips several monitors at once, and a
detection appearing in two places is a property of the data, not a bug in the story.
