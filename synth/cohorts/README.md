# `synth/cohorts` — the full lifecycle of a test

A test appears, is new, stops being new, and eventually disappears. That arc takes a month of wall clock
to accumulate for real.

Two families run side by side, and reading them together is what makes the new-test window visible:

| Family              | Emitted for | Shows                                                            |
| ------------------- | ----------- | ---------------------------------------------------------------- |
| `LongLivedCohorts`  | 30 days     | Crosses the 14-day new-test window: new, established, then gone. |
| `ShortLivedCohorts` | 10 days     | Dies **before** the window elapses, so it is never not-new.      |

A new cohort is born daily and every cohort is emitted hourly until it retires — 30 long-lived and 10
short-lived alive at once, one appearing and one retiring each day. After a month, every stage is visible
simultaneously rather than only on the day it happens.

## Retirement is derivable from the test name

```text
cohort_30d_born_2026_08_05
       └┬┘      └────┬────┘
        │            └─ birth date
        └─ emission window, in days
```

`retires_on = born + window`, computable by anyone reading the name in the product with no access to this
repo and no stored state anywhere.

Tracked in a state file instead, an unplanned gap in the schedule would be indistinguishable from an
intentional retirement — and GitHub delays and drops scheduled runs, so that gap will happen. The
generator round-trips every name through the parser before emitting it and refuses names it cannot read
back.

## What you should see

41 tests reporting within the hour, with names that date themselves. On day 11 the first short-lived
cohort resolves by absence, never having stopped being new. By day 15 the oldest long-lived cohorts have
graduated. On day 31 the first retires, having lived the whole arc.

## Configuration

| Variable                           | Default | Effect                                                |
| ---------------------------------- | ------- | ----------------------------------------------------- |
| `SYNTH_COHORT_LONG_WINDOW_DAYS`    | 30      | Must exceed the new-test window.                      |
| `SYNTH_COHORT_SHORT_WINDOW_DAYS`   | 10      | Must be under it.                                     |
| `SYNTH_COHORT_BIRTH_INTERVAL_DAYS` | 1       | Days between births. Raising it thins the test count. |
| `SYNTH_COHORTS_FAILURE_RATE`       | 12      | Rate a cohort fails at.                               |
| `SYNTH_COHORTS_SKIP_RATE`          | 3       | Rate a cohort is skipped at.                          |

Changing a window changes the test _names_, so cohorts already emitted keep theirs and retire on the old
schedule while new births use the new one. Nothing is orphaned, but the two coexist for a window.
