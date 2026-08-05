# `new-test`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/new-test-monitor>

Tests too young to be judged on the same terms as everything else. A test with three runs of history has
no meaningful failure rate, so treating it like an established one either cries wolf or buries a
genuinely broken new test in the noise.

## The story

A test is only new once, and adding one by hand is a commit. So this generates one per day over a rolling
21-day window, each named `first appeared on <date>`. Every day a genuinely new test appears and one at
the far end stops being emitted, so after three weeks every stage of the lifecycle is visible at once.

`has been here since the beginning` is the control — without it, "everything here is new" is
indistinguishable from "the monitor flags everything".

These all pass. The story is their age, not their outcome; a failure rate mixed in would make it
impossible to tell which monitor fired.

The window is 21 days against a 14-day new-test window, so the oldest members have graduated while the
newest are still in it. No absolute dates anywhere: history ages out, so a fixed date rots.

## What you should see

Today's member flagged as new on day 1. By day 15 the oldest have graduated while the newest have not.
On day 22 the oldest stops being emitted and resolves by absence.
