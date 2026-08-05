# `parking-meter`

Failure patterns that are periodic and predictable, and that **no percentage-based rate can imitate**. Two
signs on one stretch of kerb: one saying when you may not park at all, one saying what it costs when you may.

## Why it is worth having

Averaged over a month these look like ordinary flakiness — 10%, 40%, 60% — numbers that tell you nothing.
Look at _when_ each one fails and the sign is obvious. The aggregate is not merely less useful here, it
actively misleads: a rate says "sometimes", and the truth is "every 1st and 3rd Wednesday before noon".

Nothing seeded produces this. A rate has no memory of the calendar.

## [`no-parking-meter.test.ts`](__tests__/no-parking-meter.test.ts)

No balance, no cost — only the calendar.

| Test                                               | Red when                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `the street is not being cleaned right now`        | 06:00–12:00 on the 1st or 3rd Wednesday, or the 2nd or 4th Thursday. |
| `the street is not closed for the event right now` | Any hour of the 1st or 2nd Saturday.                                 |
| `parking is allowed right now`                     | Either of the above.                                                 |

The two rules have deliberately different shapes. Cleaning is a **six-hour window** on four specific
weekdays a month, so it goes red for six runs and recovers the same day. The event takes **two whole days**,
so it goes red for 24 runs straight. They overlap only by coincidence, and they recover at different times.

In August 2026, for example:

```text
Aug  1  Sat  1st Saturday   event, all day
Aug  5  Wed  1st Wednesday  cleaning 06:00–12:00
Aug  8  Sat  2nd Saturday   event, all day
Aug 13  Thu  2nd Thursday   cleaning 06:00–12:00
Aug 19  Wed  3rd Wednesday  cleaning 06:00–12:00
Aug 27  Thu  4th Thursday   cleaning 06:00–12:00
```

Across a year that is **9.9% of all hours** — a plausible-looking rate hiding a fully determined calendar.

## [`paid-parking-meter.test.ts`](__tests__/paid-parking-meter.test.ts)

Three gates, checked in order, so a failure names which one it hit:

1. **Sweeping** — every Wednesday 09:00–12:00 the kerb is closed whatever you have in your pocket. 1.8% of hours.
2. **Sunday** — free, so the test passes without looking at the balance. 14.2% of hours.
3. **Paid** — 08:00–18:00 otherwise, and it comes down to coins. 33.9% of hours.

Five drivers hold a seeded balance of 1–5 coins, fixed for the hour, against meters costing 2 to 6:

| Driver | Meter | Short during paid hours | Measured over 672 hours |
| ------ | ----- | ----------------------- | ----------------------- |
| `01`   | 2     | 20%                     | 20%                     |
| `02`   | 3     | 40%                     | 39%                     |
| `03`   | 4     | 60%                     | 56%                     |
| `04`   | 5     | 80%                     | 79%                     |
| `05`   | 6     | 100%                    | 100%                    |

Five distinguishable rates from one rule, which is what keeps them five rows rather than one repeated five
times. Driver `05` can never afford the meter, so it is the deterministic end of the ladder.

Five is also enough members to watch grouping behave: when sweeping closes the kerb, all five fail in the
same run for the same reason, which reads differently from five drivers running out of coins independently.

## Telling a real problem from a working monitor

`healthcheck always passes` reads no clock and no balance, so it stays green through every closure. Green
healthcheck plus red everything else is the street being shut, not the suite being broken.

Every failure message prints the day, the hour, and which rule fired — including which occurrence of the
weekday it is, since that is the part you cannot infer from a timestamp alone.

## Usage

```bash
pnpm --filter @flaky-tests-demo/apps-parking-meter test
```

Non-zero exit is expected. All times are UTC: a local timezone would make every rule here depend on
daylight saving.
