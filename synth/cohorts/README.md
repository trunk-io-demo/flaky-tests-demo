# `synth/cohorts` — the full lifecycle of a test

## What this demonstrates

A test's lifecycle: it appears, it is new, it stops being new, and eventually it disappears. That
arc takes a month of wall clock to accumulate for real, and a demo cannot wait a month.

Two families run side by side, and reading them together is what makes the new-test window
visible:

| Family              | Emitted for | What it shows                                                                        |
| ------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `LongLivedCohorts`  | 30 days     | Crosses the new-test window (14 days by default): new, then established, then gone.  |
| `ShortLivedCohorts` | 10 days     | Dies **before** the window elapses, so it is never not-new. The deliberate contrast. |

A new cohort is born every day and every cohort is emitted every hour until it retires. At steady
state that is 30 long-lived and 10 short-lived tests alive at once, with one appearing and one
retiring each day.

## Retirement is derivable from the test name

This is the part worth understanding, because it is what keeps the story honest.

```text
cohort_30d_born_2026_08_04
       └┬┘      └────┬────┘
        │            └─ birth date
        └─ emission window, in days
```

`retires_on = born + window`. That is computable by anyone reading the test name in the product,
with no access to this repo and no stored state anywhere.

The alternative — tracking retirement in a state file or a table — would make an unplanned gap in
the schedule indistinguishable from an intentional retirement. GitHub delays and drops scheduled
runs, so that gap will happen, and "resolved because the test retired" has to remain
distinguishable from "resolved because our CI broke."

The generator checks the round trip at runtime and refuses to emit a name it cannot parse back.

## The healthcheck

`Healthcheck::cohort_generator_is_reporting` always passes and never retires. It is how you tell
"the cohorts retired" from "the generator stopped running" — several monitors resolve on absence
of data, and those two look identical without it.

## What you should see in the product

| When           | What                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Within an hour | 41 tests reporting, with names that date themselves.                                                                |
| Day 1          | Both families' newest members flagged as new tests.                                                                 |
| Day 11         | The first short-lived cohort has stopped reporting, and resolves by absence — while never having stopped being new. |
| Day 15         | The oldest long-lived cohorts stop being new. The short-lived family still has none that ever did.                  |
| Day 31         | The first long-lived cohort retires, having lived the whole arc.                                                    |

Because a new cohort is born daily, all of these states are visible simultaneously once the
generator has been running for a month — you do not have to wait for a specific day to see a
specific stage.

## Configuration

| Variable                           | Default | Effect                                                              |
| ---------------------------------- | ------- | ------------------------------------------------------------------- |
| `SYNTH_COHORT_LONG_WINDOW_DAYS`    | 30      | Long-lived emission window. Must exceed the new-test window.        |
| `SYNTH_COHORT_SHORT_WINDOW_DAYS`   | 10      | Short-lived emission window. Must be under the new-test window.     |
| `SYNTH_COHORT_BIRTH_INTERVAL_DAYS` | 1       | Days between births. Raising it thins the story and the test count. |
| `SYNTH_COHORTS_FAILURE_RATE`       | 12      | Percentage of runs a cohort fails in.                               |
| `SYNTH_COHORTS_SKIP_RATE`          | 3       | Percentage of runs a cohort is skipped in.                          |

Changing a window changes the test _names_, and names are identity — cohorts emitted under the old
window keep their old names and retire on their old schedule, while new births use the new one.
Nothing is orphaned, but the two coexist for a window's length.

## Uploads

Cohorts upload as a protected-branch (`PB`) run. The arc is about a test's lifetime, which only
reads against the branch that accumulates history.

## Related

- [`../README.md`](../README.md) — how `synth/` works and how to verify it locally
- [`../../docs/monitors.md`](../../docs/monitors.md) — the monitor catalog
- [`../../docs/configuration.md`](../../docs/configuration.md) — every variable
- [`../../docs/operations.md`](../../docs/operations.md) — why missing runs resolve monitors
