# `mass-detection`

> [!NOTE]
> **Twenty tests here fail on the 1st and the 15th of every month, UTC.** A passing test logs the same thing into the
> run history, because a whole suite going flaky at once is indistinguishable from a real regression.

## Prototypical examples

The ones to open in a demo. Links go to the test's page in the app. **The burst is the story**, so the
grouping view matters more here than any single test.

| Test                        | Why this one                                                                          | Production |
| --------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| `archives an order`         | The 20% member — busiest on ordinary days, so it has history either side of a spike.  | _TBD_      |
| `creates an order`          | The 1% member. Nearly flat until an event day, when it fails with the other nineteen. | _TBD_      |
| `healthcheck always passes` | Green on an event day, which is how you tell a mass detection from a dead suite.      | _TBD_      |

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
burst reads like a real subsystem failing rather than a loop with an index.

Each also carries its own small everyday rate, 1% through 20%, so the twenty are distinguishable on
ordinary days rather than twenty identical rows. On an event day they fail together regardless.

`healthcheck always passes` passes on an event day too, which makes it the only green thing in the
folder that day and the fastest way to tell a mass detection from a dead suite.

## Why a recurring rule, not a date

Two constraints pull against each other. History ages out, so every window here is relative to now and a
fixed date would rot. But this story has to stay **discoverable**, which usually means a date.

"The 1st and the 15th" satisfies both: computable from any date, never rots, and exactly as easy to check
against a timestamp in the product. Both are under 28, so February behaves like every other month.

Twice a month rather than once, because two spikes in a short history read as a cycle where one reads as an
accident. The gaps are 14, 16, or 17 days depending on the month — near-fortnightly rather than exactly so.
An exact 14-day rule would need to count from the epoch, which drifts across months and stops being a date
anyone can check at a glance.

## What you should see

On ordinary days, a handful of failures spread across the twenty at their own rates. On an event day, 20
failures in a single run, repeated hourly for 24 hours, then all resolving at once — twice a month. **What your monitor configuration does with 20 simultaneous
detections is the thing being tested** — how they group, and how much coverage quarantining takes with
them.
