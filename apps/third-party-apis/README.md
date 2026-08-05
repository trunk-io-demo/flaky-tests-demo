# `third-party-apis`

> [!NOTE]
> **Depends on a third party.** This fails when GitHub's unauthenticated rate limit is exhausted for the
> runner's IP. Every failure message names which of three causes it was.

## What this demonstrates

**Failures that cluster in time and correlate across tests.**

When the budget runs out, every test that needs it fails — in the same run, for the same reason — and then
they all recover together at the top of the hour. No per-test failure rate models that, and no generator
produces it, because the cause is shared state outside the suite entirely.

## Telling the two apart

| Message says          | Meaning                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **rate limited**      | The budget was gone. **The monitor worked.** The limit is 60/hour _per IP_ and CI runners share IPs, so this happens for reasons unrelated to us. |
| **request failed**    | Network or DNS on the runner. Not the story.                                                                                                      |
| **budget unreadable** | `/rate_limit` did not answer, which usually means the first case too.                                                                             |

## Politeness, decided explicitly

The naive way to demonstrate rate limiting is to hammer an endpoint until it says no. This does not do
that.

`GET /rate_limit` does not count against the limit it reports, so the budget is observed for free every
run. The burst that spends budget is small, **sequential**, and capped — sequential because a parallel
burst is a spike against somebody else's service, and because it would make the outcome depend on
connection scheduling rather than on the budget.

**The failures come from the budget being shared, not from us exhausting it.** At six requests per run
this repo uses about 10% of an hourly budget it does not own, which is the number to have in mind before
raising it.

## What you should see

A log line with the remaining budget every run. When the shared budget is low, both network tests failing
in the same run with the healthcheck green, then both recovering at the top of the hour. Over a week,
clusters rather than scatter — and a correlation between two tests that a per-test view cannot show.
