# `parking-meter`

A failure pattern that is periodic and predictable, and that **no percentage-based rate can imitate**.
Parking is paid 08:00–18:00 UTC, Monday to Saturday, and free otherwise.

## Why it is worth having

Averaged over a week, `parking is free right now` fails about 42% of runs. That number looks exactly like
ordinary flakiness and tells you nothing.

Look at **when** it fails and the pattern is unmistakable: never on a Sunday, never before 08:00, never
after 18:00. A monitor reporting only a rate cannot distinguish this from a coin flip.

That is the specific value here. It is not that the aggregate is less useful than the detail — it is that
the aggregate is **actively misleading**. 42% says the test is unreliable; the run times say the test is
right and the assumption inside it is wrong.

## The story

`parking is free right now` and `parking costs money right now` are inverses, so exactly one fails on
every run. The suite's total failure count is therefore perfectly flat while its composition swings on a
cycle — which makes the same point to a count-based monitor, which sees nothing at all here.

Nothing is mocked: the tests read the real clock, so their history is a genuine time series. Everything
is UTC, because a local timezone would make the pattern depend on daylight saving and turn a clean
periodic signal into an almost-periodic one.

## What you should see

Within a day, the failures fall in a contiguous block of hours rather than scattered. Within a week, the
Sunday gap is visible and the block repeats at the same hours daily. A failure-rate monitor fires on both
tests at rates that look like noise; looking at the run times is what resolves it.
