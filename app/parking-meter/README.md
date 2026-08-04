# `parking-meter`

## What this scenario demonstrates

A failure pattern that is **periodic and predictable**, and that no percentage-based rate can
imitate.

The rule is the one every city has and every parking app gets wrong: parking is paid on weekdays and
Saturday between 08:00 and 18:00 UTC, and free on Sunday and outside those hours.

## Why it is worth having

Averaged over a week, `parking_is_free_right_now` fails about 42% of runs. That number looks exactly
like ordinary flakiness and tells you nothing at all.

Look at **when** it fails and the pattern is unmistakable: never on a Sunday, never before 08:00,
never after 18:00. A monitor reporting only a rate cannot distinguish this from a coin flip.

That is the specific value of this scenario. It is not that the aggregate is less useful than the
detail — it is that the aggregate is **actively misleading**. Somebody looking at a 42% failure rate
concludes the test is unreliable. Somebody looking at the times concludes the test is _correct_ and
the assumption in it is wrong, which is a different and much more useful conclusion.

## The story in this folder

| Test                                                        | Behavior                                           |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `healthcheck_always_passes`                                 | Never fails.                                       |
| `parking_is_free_right_now`                                 | Fails inside the paid window.                      |
| `parking_costs_money_right_now`                             | Fails outside it. The inverse.                     |
| `the_schedule_is_free_on_sundays_and_outside_working_hours` | Asserts the rule directly, offline. Always passes. |

Exactly one of the two middle tests fails on every run, which makes the suite's **total failure count
perfectly flat** while its composition swings on a cycle. A count-based monitor sees nothing here at
all — which is another way of making the same point.

Nothing is mocked. The tests read the real clock, so their history is a genuine time series.

## What you should see in the product

| When           | What                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Within an hour | One of the two paired tests failing.                                                                                    |
| Within a day   | The failures fall in a contiguous block of hours, not scattered.                                                        |
| Within a week  | The Sunday gap is visible, and the block repeats at the same hours daily.                                               |
| Day 1–2        | A failure-rate monitor fires on both tests at rates that look like noise. Looking at the run times is what resolves it. |

## Configuration

| Variable                 | Default | Effect                                        |
| ------------------------ | ------- | --------------------------------------------- |
| `APP_PARKING_PAID_HOURS` | `8-18`  | The paid window, as `START-END` hours in UTC. |

Everything is UTC, deliberately. A local timezone would make the pattern depend on where the runner
is and on daylight saving, which would turn a clean periodic signal into an almost-periodic one — the
worst of both.

Widening the window raises the failure rate of the first test and lowers the second's. It cannot make
the total count anything other than exactly one per run.

## Links

- Up: [`app/README.md`](../README.md)
- Up: [`docs/monitors.md`](../../docs/monitors.md)
- Sideways: [`monitors/failure-rate`](../../monitors/failure-rate/README.md) — a rate that genuinely
  _is_ a rate, for contrast
