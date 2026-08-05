# `failure-rate`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/failure-rate-monitor>

What percentage of a test's recent runs failed. The monitor most teams turn on first, and the one most
likely to be too noisy or too quiet depending on where the threshold lands.

## The story

Three tests differing in exactly one thing — the percentage. Set a threshold anywhere between two of
them and you can see which side each lands on.

| Test                        | Fails |
| --------------------------- | ----- |
| `healthcheck always passes` | never |
| `fails on a low rate`       | 8%    |
| `fails on a medium rate`    | 30%   |
| `fails on a high rate`      | 65%   |

The rates are constants in the test file, not repository variables, so the names carry no numbers — a
name with the number in it would start lying the first time somebody tuned it.

Outcomes are seeded on the test name and the current UTC hour, so a run differs from the last one and
still reproduces exactly in a fork. Every failure message prints its rate and bucket.

## What you should see

A single run says nothing: 8% and 30% are indistinguishable in one sample. After a day of hourly runs
the three separate cleanly, and a monitor with a threshold between two of them fires on the ones above
and stays silent on the ones below.
