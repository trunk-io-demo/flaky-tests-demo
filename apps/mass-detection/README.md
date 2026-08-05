# `mass-detection`

> [!NOTE]
> **Twenty tests here fail on day 13 of every month, UTC.** A passing test logs the same thing into the
> run history, because a whole suite going flaky at once is indistinguishable from a real regression.

## What this demonstrates

Detection **volume** and **grouping**, rather than single detections.

Every other story here produces one or two findings. This one produces twenty at once, which asks the
product a different question: are they grouped into one event or reported as twenty unrelated flaky
tests, and what happens when quarantining acts on all of them?

That second half is the interesting risk. Twenty tests classified flaky and quarantined together is a
whole subsystem's coverage removed silently — the suite goes green again and stops testing anything.
A per-test failure rate cannot express "these twenty are one problem", so it cannot tell you that either.

It is also the shape a real regression has. An infrastructure change does not make one test flaky; it
makes a subsystem's whole suite fail together, in the same run, for the same reason.

## The story

Twenty tests named after order-processing operations — `charges a card`, `reserves inventory` — so the
burst reads like a real subsystem failing rather than a loop with an index. They pass every day except
one.

`healthcheck always passes` passes on the event day too, which makes it the only green thing in the
folder that day and the fastest way to tell a mass detection from a dead suite.

## Why a recurring rule, not a date

Two constraints pull against each other. History ages out, so every window here is relative to now and a
fixed date would rot. But this story has to stay **discoverable**, which usually means a date.

"The 13th of every month" satisfies both: computable from any date, never rots, and exactly as easy to
check against a timestamp in the product. Capped at 28 so it never skips February.

## What you should see

22 green tests on ordinary days. On the event day, 20 failures in a single run, repeated hourly for 24
hours, then all resolving at once. **What your monitor configuration does with 20 simultaneous
detections is the thing being tested** — how they group, and how much coverage quarantining takes with
them.
