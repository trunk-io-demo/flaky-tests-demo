# `apps/` — where real execution earns its keep

Real tests against surfaces that genuinely misbehave. Nothing here is mocked or generated: each
scenario's history is a real time series produced by real conditions.

That is the difference from [`synth/`](../synth/), which fabricates arcs that would take weeks to
accumulate. `apps/` produces the ones that cannot be fabricated convincingly.

| Scenario                                 | Why it is compelling                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`parking-meter/`](parking-meter/)       | A periodic pattern **no percentage-based rate can imitate**, that an aggregate actively misleads about. |
| [`mass-detection/`](mass-detection/)     | The only scenario exercising detection **volume** and grouping rather than single detections.           |
| [`third-party-apis/`](third-party-apis/) | Failures that cluster in time and **correlate across tests**, recovering together.                      |
| [`github-uptime/`](github-uptime/)       | A real external dependency causing real intermittency.                                                  |

## ⚠️ Three of these can look like a real problem

That is the point, but it must be possible to tell _"the monitor worked"_ from _"something is broken"_.
Each is triageable in one lookup:

| Scenario           | How to tell                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `mass-detection`   | Fires on **day 13 of every month, UTC**. Check the date; its healthcheck stays green.                                 |
| `third-party-apis` | The failure message names the cause: rate limited, request failed, or budget unreadable. Only the first is the story. |
| `github-uptime`    | Open <https://www.githubstatus.com>. If GitHub is degraded, the monitor worked.                                       |
| `parking-meter`    | The failure message prints the day, the hour, and the schedule.                                                       |

Third-party-dependent tests carry a ⚠️ at the top of their file, and their failure messages always say
so. Identifying such a failure should never require reading the implementation.

## Being a good citizen

External calls happen **once per test run**, never in a loop, with a timeout and a user-agent
identifying this repository. `third-party-apis` reads GitHub's `/rate_limit`, which does not count
against the limit it reports, so the budget is observed for free; the burst that spends it is small,
sequential, and capped.
