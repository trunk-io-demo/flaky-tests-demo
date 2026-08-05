# `mass-detection`

## ⚠️ Read this first: the trigger

**Twenty tests in this folder fail on day 13 of every month, UTC.** By default —
`APPS_MASS_DETECTION_DAY_OF_MONTH` changes it.

This is written here, in [`docs/operations.md`](../../docs/operations.md), and in a passing test named
`the_next_mass_detection_event_is_announced_here` that logs the next occurrence. Three places, because
a whole suite going flaky at once is **indistinguishable from a real incident**, and this org is one
the team alerts on. Somebody paged at 03:00 needs to answer "is this ours?" in one lookup.

## What this scenario demonstrates

Alert **volume** and **grouping**, rather than single detections.

Every other story in this repo produces one or two findings. This one produces twenty at once, which
asks the product a different question: does it group them into one event, does it rate-limit the
notifications, and does the on-call person get one page or twenty?

It is also the shape a real incident has. An infrastructure change or a bad deploy does not make one
test flaky — it makes a subsystem's whole suite fail together, in the same run, for the same reason. A
per-test failure rate cannot express "these twenty are one problem."

## The story in this folder

| Test                                              | Behavior                                                                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `healthcheck_always_passes`                       | Never fails, **including on the event day**. On that day it is the only green thing in the folder, which is the fastest way to tell a mass detection from the suite having died. |
| `the_next_mass_detection_event_is_announced_here` | Always passes. Logs the next occurrence, putting the trigger in the run history itself.                                                                                          |
| 20 tests named after order-processing operations  | Pass every day except one. On the event day they all fail together.                                                                                                              |

The names are plausible — `charges_a_card`, `reserves_inventory`, `issues_a_receipt` — so the burst
reads like a real subsystem failing rather than like a loop with an index.

## Why a recurring rule and not a date

Two constraints pull against each other.

Run history ages out after roughly 60 days, so every window in this repo is expressed **relative to
now, never as an absolute date**. A story pinned to a fixed date rots, and a fork of it is born
already rotten.

But this scenario has to be **discoverable**, which usually means a date.

A recurring rule satisfies both. "The 13th of every month" is computable from any date, never rots,
and is exactly as easy to check against a pager timestamp as a single date would be.

The day is capped at 28. Days 29 through 31 do not exist in every month, so a higher value would
silently skip February and make the story irregular in a way nobody could triage.

## What you should see in the product

| When              | What                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Ordinary days     | 22 tests, all green.                                                                             |
| The event day     | 20 failures in a single run, repeated every hour for 24 hours.                                   |
| The event day     | Whatever your alerting does with 20 simultaneous detections. **That is the thing being tested.** |
| The following day | All 20 resolve at once.                                                                          |

If your monitor configuration turns this into twenty separate pages, that is a finding about the
configuration, and it is the finding this scenario exists to produce.

## Configuration

| Variable                           | Default | Effect                                           |
| ---------------------------------- | ------- | ------------------------------------------------ |
| `APPS_MASS_DETECTION_DAY_OF_MONTH` | 13      | Day of each month the event fires. Capped at 28. |

The suite size is fixed at twenty in code. It is the volume being demonstrated, so it is not something
a fork should tune without deciding it wants a different demonstration.

**Changing the day mid-month can fire the event immediately.** If you set it to today, twenty tests
start failing on the next run. That is not a bug, but it will page somebody.

## Links

- Up: [`apps/README.md`](../README.md)
- Up: [`docs/monitors.md`](../../docs/monitors.md) — the whole catalog
- Up: [`docs/operations.md`](../../docs/operations.md) — where this trigger is also recorded
- Sideways: [`monitors/failure-count`](../../monitors/failure-count/README.md) — a count that is
  steady rather than a burst
