# `new-test`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/new-test-monitor>

When a test is newly added, or newly appears on a particular branch pattern. For example, the presence of the label could indicate if it is newly present on `main`.

## The story

A test is only new once, and adding one by hand is a commit. So this generates one per day over a rolling
21-day window, each named `first appeared on <date>`. Every day a genuinely new test appears and one at
the far end stops being emitted, so after three weeks every stage of the lifecycle is visible at once.

Each member fails at a rate that decays with age — newest 15%, oldest 1%. That is realistic, since tests
stabilize as they settle, and it is the reason the monitor exists: a new test has no history to judge a
rate against. It also keeps the 21 members from being 21 identical tests.

The window is 21 days against a 14-day new-test window, so the oldest members have graduated while the
newest are still in it. No absolute dates anywhere: history ages out, so a fixed date rots.

## What you should see

Today's member flagged as new on day 1. By day 15 the oldest have graduated while the newest have not, and
the graduated ones are visibly quieter. On day 22 the oldest stops being emitted and resolves by absence.
