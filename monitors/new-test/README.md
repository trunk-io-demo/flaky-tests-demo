# `new-test`

## What this monitor detects

Tests that have not been around long enough to be judged on the same terms as everything else.

A test with three runs of history has no meaningful failure rate. Treating it like an established
test either cries wolf on a single unlucky run or buries a genuinely broken new test in the noise.
So the monitor gives new tests their own window — 14 days by default — and holds off until they have
enough history to say something about.

## The story in this folder

Demonstrating this is awkward: a test is only new **once**, and adding one by hand is a commit.

So [`canonical.test.ts`](canonical.test.ts) generates one test per day over a rolling window, each
named for the day it first appeared:

```text
first_appeared_on_2026_08_04
```

Every day a genuinely new test appears here, and one at the far end silently stops being emitted.
After three weeks of running, every stage of the lifecycle is visible **at once** — you do not have
to wait for a particular day to see a particular stage.

| Test                                | Role                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `healthcheck_always_passes`         | Never fails.                                                                                                                      |
| `has_been_here_since_the_beginning` | The control: emphatically not new. Without it, "everything here is new" is indistinguishable from "the monitor flags everything." |
| `first_appeared_on_…` × 21          | One per day of the window. The newest is hours old; the oldest is about to stop being emitted.                                    |

These all **pass**. The story is their age, not their outcome — mixing a failure rate in here would
make it impossible to tell which monitor fired.

### No absolute dates, anywhere

Run history ages out after roughly 60 days, so a story pinned to a fixed date rots and a fork of it
is born rotten. The window is expressed relative to today and the names fall out of it.

## What you should see in the product

| When           | What                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Within an hour | 23 tests reporting, with names that date themselves.                                                                       |
| Day 1          | Today's `first_appeared_on_…` flagged as a new test.                                                                       |
| Day 15         | The oldest members have graduated out of the new-test window while the newest are still in it. That contrast is the story. |
| Day 22         | The oldest member stops being emitted and resolves by absence.                                                             |

## Deliberate overlap with other monitors

- **[`synth/cohorts`](../../synth/cohorts/README.md)** — the same lifecycle, told synthetically and
  over a longer arc, with two windows side by side. This folder is the live version: real tests, a
  real runner. Read `synth/cohorts` for the full new → established → gone arc and this one for proof
  that it happens to tests that actually execute.
- **[`skipped-test`](../skipped-test/README.md)** — the far end of this window resolves by absence,
  which is a different absence from a skip. A skipped test reports; a retired one does not.

## Configuration

| Variable                        | Default | Effect                                                |
| ------------------------------- | ------- | ----------------------------------------------------- |
| `MONITORS_NEW_TEST_WINDOW_DAYS` | 21      | Days of rolling window, and therefore how many tests. |

Keep it **above** the new-test window itself (14 days by default), or every test here is always new
and the graduated half of the story disappears. 21 against 14 leaves a clear week of graduated
tests.

Lowering it retires the excess members immediately, which is a real resolution-by-absence event
rather than a mistake — but it is a lot of them at once, and will look like an incident.

## Links

- Up: [`docs/monitors.md`](../../docs/monitors.md)
- Up: [`docs/configuration.md`](../../docs/configuration.md)
- Sideways: [`synth/cohorts`](../../synth/cohorts/README.md) — the same lifecycle, synthetically
