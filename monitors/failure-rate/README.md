# `failure-rate`

> [!NOTE]
> **What this monitor does, in the product docs:**
> <https://docs.trunk.io/flaky-tests/detection/failure-rate-monitor>
>
> [`monitors/README.md`](../README.md) indexes every monitor story and [`CLAUDE.md`](../CLAUDE.md) has the conventions for changing them. [`CONTRIBUTING.md`](../../CONTRIBUTING.md) has the three rate variables.
>
> Read this against [`failure-count`](../failure-count/README.md) for the same failures as a count, and [`synth/branch-rates`](../../synth/branch-rates/README.md) for the same monitor scoped by branch.

## What this monitor detects

What fraction of a test's recent runs failed. Not "did it fail" — every test fails sometimes — but
"does it fail _often enough_ to be worth someone's attention." You give it a threshold; it tells you
which tests are above it.

It is the monitor most teams turn on first, and the one most likely to be either too noisy or too
quiet depending on where the threshold lands. Which is what this folder is for.

## The story in this folder

Four tests in [`canonical.test.ts`](canonical.test.ts), differing in exactly one thing:

| Test                        | Default rate | Mechanism                                                    |
| --------------------------- | ------------ | ------------------------------------------------------------ |
| `healthcheck_always_passes` | 0%           | Asserts on the clock. Cannot fail.                           |
| `fails_on_a_low_rate`       | 8%           | Fails when a seeded draw for this hour lands under the rate. |
| `fails_on_a_medium_rate`    | 30%          | Same, with a higher rate.                                    |
| `fails_on_a_high_rate`      | 65%          | Same, with a higher rate again.                              |

Nothing else about these tests is interesting, and that is the design. Set a threshold anywhere
between two of them and you can see exactly which side each one lands on.

### How a rate can be both random and reproducible

Three things have to be true at once, and they pull against each other:

- the rate is tunable from a **repository variable**, not by editing the test;
- the outcome **differs between runs**, or there is no rate to observe;
- the outcome is **reproducible**, so a fork tells the same story and a surprising run can be
  replayed.

`Math.random()` gives up the third. A hardcoded outcome gives up the second. So
[`utils`](../utils/) seeds a small, fully specified generator from the test's name and the current
UTC hour. Within one hourly run each test has a fixed, computable outcome; the next hour is a fresh
draw. Every failure message prints its rate and its hour bucket, so a failure can always be traced
back to a decision rather than to chance.

`monitors/utils` is deliberately duplicated in the monitor packages that need it rather than shared from
one place — each story is meant to be readable by someone who opened one folder and nothing else.

### The test names do not contain the numbers

`fails_on_a_low_rate`, not `fails_10_percent_of_runs`. The rates are repository variables, so a name
with a number in it starts lying the first time someone tunes the demo. The numbers live in the
table above, and in the failure messages, both of which can be updated.

## What you should see in the product

| When           | What                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Within an hour | Four tests reporting, with one to two of the three rate tests failing.                                                      |
| Within a day   | 24 runs. `fails_on_a_high_rate` sits near 65%, `fails_on_a_low_rate` near 8%.                                               |
| Day 1–2        | A failure-rate monitor with a threshold between two of them fires on the tests above it and stays silent on the ones below. |

A single run says nothing — 8% and 30% are indistinguishable in one sample. Give it a day before
concluding anything, including that something is broken.

The healthcheck is how you tell "this monitor resolved" from "this suite stopped reporting." Several
monitors resolve on absence of data, so those two look identical without it. If the healthcheck is
green, everything else you see is the story.

## Deliberate overlap with other monitors

The same runs also feed:

- **[`failure-count`](../failure-count/README.md)** — three tests failing in the same run is a
  count as well as a rate, and the two monitors disagree interestingly about a burst. _(pending)_
- **[`new-test`](../new-test/README.md)** — these tests are new exactly once, on the first run after
  they land. _(pending)_

Real flakiness trips several monitors at once, so the overlaps are the point rather than a smell.

## Configuration

| Variable                       | Default | Effect                             |
| ------------------------------ | ------- | ---------------------------------- |
| `MONITORS_FAILURE_RATE_LOW`    | 8       | Rate for `fails_on_a_low_rate`.    |
| `MONITORS_FAILURE_RATE_MEDIUM` | 30      | Rate for `fails_on_a_medium_rate`. |
| `MONITORS_FAILURE_RATE_HIGH`   | 65      | Rate for `fails_on_a_high_rate`.   |

A value outside 0–100, or one that is not a number, logs a warning and falls back to the default
rather than failing the suite. A typo in a variable should show up as the demo being less noisy than
expected, not as a red run that looks like a real breakage.

Keep the three separated by enough margin that a day's worth of runs distinguishes them. Low at 8
and medium at 12 is not a story anyone can read.
