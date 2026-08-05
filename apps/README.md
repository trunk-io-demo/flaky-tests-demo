# `apps/` — where real execution earns its keep

Real tests, running for real, against surfaces that genuinely misbehave. Nothing here is mocked and
nothing is generated: each scenario's history is a real time series produced by real conditions.

That is the difference between this directory and [`synth/`](../synth/). `synth/` fabricates arcs that
would take weeks of wall clock to accumulate. `apps/` produces the ones that cannot be fabricated
convincingly — a periodic schedule, an external outage, a shared rate limit.

| Scenario                                 | Behavior                                                | Why it is compelling                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [`parking-meter/`](parking-meter/)       | Passes or fails on time-of-day and day-of-week windows. | A periodic, predictable pattern **no percentage-based rate can imitate**, and one that an aggregate actively misleads about. |
| [`mass-detection/`](mass-detection/)     | A whole suite becomes flaky one day a month.            | The only scenario exercising alert **volume** and grouping rather than single detections.                                    |
| [`third-party-apis/`](third-party-apis/) | Calls a public API against a shared rate-limit budget.  | Failures that cluster in time and **correlate across tests**, recovering together.                                           |
| [`github-uptime/`](github-uptime/)       | Outcome tracks GitHub's actual availability.            | A real external dependency causing real intermittency. No generator produces this.                                           |

## ⚠️ Two of these will occasionally look like an incident

That is the point, but it has to be possible to tell _"the monitor worked"_ from _"we have a
problem."_ Every scenario below is triageable in one lookup:

| Scenario           | Looks like                                                          | How to tell                                                                                                                           |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `mass-detection`   | A bad deploy or an infrastructure change.                           | It fires on **day 13 of every month, UTC** by default. Check the date. Also written in [`docs/operations.md`](../docs/operations.md). |
| `third-party-apis` | A broken integration.                                               | The failure message names the cause: rate limited, request failed, or budget unreadable. Only the first is the story.                 |
| `github-uptime`    | A broken integration.                                               | Open https://www.githubstatus.com. If GitHub is degraded, the monitor worked.                                                         |
| `parking-meter`    | Nothing — it is periodic, so it is obvious once you look at _when_. | The failure message prints the day, the hour, and the schedule.                                                                       |

Tests that depend on a third party carry a `⚠️` note at the top of their file, and their failure
messages always say so explicitly. A failure caused by somebody else's outage should never require
reading the implementation to identify.

## Cadence, and being a good citizen

The external calls are made **once per test run**, never in a loop, always with a timeout and a
user-agent identifying this repository. Hourly is already generous for a status endpoint, and there is
no version of any story here that needs it more often.

`third-party-apis` reads GitHub's `/rate_limit` endpoint, which does not count against the limit it
reports, so the budget is observed for free. The burst that actually spends budget is small,
sequential, and hard-capped — see [`third-party-apis/budget.ts`](third-party-apis/budget.ts), which
explains each choice.

## Related

- [`docs/monitors.md`](../docs/monitors.md) — which monitor each scenario demonstrates
- [`docs/operations.md`](../docs/operations.md) — the mass-detection trigger, and what to check when data stops
- [`monitors/`](../monitors/) — the same monitors, demonstrated by mechanism rather than by scenario
