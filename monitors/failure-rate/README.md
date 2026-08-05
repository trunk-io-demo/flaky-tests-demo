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

## Other monitors

| Monitor                                               | How it overlaps                                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`pass-on-retry`](../pass-on-retry/README.md)         | Scheduled runs share a head commit, so a rung that fails one hour and passes the next has done both on one commit — a pair, formed by accident. The higher rungs pair most often. |
| [`failure-count`](../failure-count/README.md)         | The same failures read as a number rather than a proportion. A rate cannot tell one noisy test from twelve.                                                                       |
| [`new-test`](../new-test/README.md)                   | Every rung was new once, and a rate over three runs means nothing — which is the reason the new-test window exists.                                                               |
| [`timeout-inflation`](../timeout-inflation/README.md) | A rate says nothing about _how_ a test fails. Two tests at the same rate can need completely different investigations.                                                            |
| [`slow-test`](../slow-test/README.md)                 | Everything there passes, so a rate monitor sees nothing at all. A test can rot without ever failing.                                                                              |

Real flakiness trips several monitors at once, so these overlaps are the point rather than a smell.
