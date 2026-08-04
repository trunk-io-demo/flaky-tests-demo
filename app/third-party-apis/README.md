# `third-party-apis`

## ⚠️ This scenario depends on a third party

**It fails when GitHub's unauthenticated rate limit is exhausted for the runner's IP**, and that is
deliberate. See "telling the two apart" below.

## What this scenario demonstrates

**Failures that cluster in time and correlate across tests.**

Rate limiting produces a shape nothing else in this repo does. When the budget runs out, every test
that needs it fails — in the same run, for the same reason — and then they all recover together at the
top of the hour.

No per-test failure rate models that. No generator produces it either, because the cause is shared
state outside the suite entirely.

## Telling "the monitor worked" from "we have a problem"

Read the failure message. Every failure here names which of three things happened:

| Message says          | Meaning                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **rate limited**      | The budget was gone. **The monitor worked.** GitHub's unauthenticated limit is 60 requests per hour _per IP_, and CI runners share IPs with everything else on the platform — so this happens for reasons that have nothing to do with us. |
| **request failed**    | Network or DNS on the runner. Not the story, and not GitHub's fault either.                                                                                                                                                                |
| **budget unreadable** | `GET /rate_limit` itself did not answer, which usually means the first case is also true.                                                                                                                                                  |

## Politeness, decided explicitly

The naive way to demonstrate rate limiting is to hammer an endpoint until it says no. This does not do
that.

- **`GET /rate_limit` does not count against the limit it reports** — GitHub documents this — so the
  budget is observed for free, every run.
- The burst that actually spends budget is **small, sequential, and hard-capped** at 20. Sequential
  rather than parallel because a parallel burst is a spike against somebody else's service, and because
  it would make the outcome depend on connection scheduling rather than on the budget, blurring the
  signal.
- **The failures come from the budget being shared, not from us exhausting it.** That is both the polite
  design and the more realistic one.

Raising `APP_THIRD_PARTY_BURST` is how you make this fire more often, and it is paid for out of
everybody else's budget on that runner. The cap exists because that cost is real.

## The story in this folder

| Test                                                  | Behavior                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `healthcheck_always_passes`                           | Never fails, never touches the network.                                        |
| `there_is_enough_rate_limit_budget_left_to_work_with` | Reads the budget for free. Fails when there is less left than the burst needs. |
| `a_small_burst_of_api_calls_all_succeed`              | Spends the burst. Fails when any request is refused.                           |
| `the_burst_size_is_capped`                            | Asserts the cap offline, so its existence is discoverable.                     |

The two middle tests are what make the correlation legible: they fail for the same reason, at the same
moment, and recover at the same moment.

## What you should see in the product

| When                          | What                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Every run                     | A log line with the remaining budget out of 60.                                                      |
| When the shared budget is low | Both network tests failing **in the same run**, and the healthcheck green.                           |
| At the top of the hour        | Both recovering together, because the budget resets hourly.                                          |
| Over a week                   | Clusters rather than scatter — and a correlation between two tests that a per-test view cannot show. |

## Configuration

| Variable                | Default | Effect                                                    |
| ----------------------- | ------- | --------------------------------------------------------- |
| `APP_THIRD_PARTY_BURST` | 6       | Requests per run that spend budget. Capped at 20 in code. |

At the default this repo uses about 6 of 60 requests per hour on a shared IP — around 10% of a budget
it does not own. That is the number to have in mind before raising it.

## Links

- Up: [`app/README.md`](../README.md)
- Up: [`docs/monitors.md`](../../docs/monitors.md)
- Sideways: [`github-uptime`](../github-uptime/README.md) — the other scenario that fails on somebody
  else's behalf
