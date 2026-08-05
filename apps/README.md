# `apps/` — where real execution earns its keep

Real tests against surfaces that genuinely misbehave. Nothing here is mocked or generated: each
scenario's history is a real time series produced by real conditions.

Mimic what would happen with a real-world test that depends on a certain external scenario.

| Scenario                                 | Why it is compelling                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`parking-meter/`](parking-meter/)       | Periodic patterns **no percentage-based rate can imitate**, that an aggregate actively misleads about. |
| [`mass-detection/`](mass-detection/)     | The only scenario exercising detection **volume** and grouping rather than single detections.          |
| [`third-party-apis/`](third-party-apis/) | Failures that cluster in time and **correlate across tests**, recovering together.                     |
| [`github-uptime/`](github-uptime/)       | A real external dependency causing real intermittency, plus three thresholds strangers move for us.    |

## Layout

Each package splits `src/` from `__tests__/`. The scenarios here carry real clients — a status page, a
rate-limit budget, a search API — and keeping the thing being tested apart from the test that reads it is
worth the two directories.

**This is local to `apps/`.** `monitors/` keeps its tests flat beside the story they tell, because there is
nothing there to separate: the test _is_ the implementation.

## ⚠️ Three of these can look like a real problem

That is the point, but it must be possible to tell _"the monitor worked"_ from _"something is broken"_.
Each is triageable in one lookup:

| Scenario           | How to tell                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mass-detection`   | Fires on **the 1st and the 15th, UTC**. Check the date; its healthcheck stays green.                                                              |
| `third-party-apis` | The failure message names the cause: rate limited, request failed, or budget unreadable. Only the first is the story.                             |
| `github-uptime`    | Open <https://www.githubstatus.com>. If GitHub is degraded, the monitor worked. Issue-volume failures are strangers filing issues, not a problem. |
| `parking-meter`    | The failure message prints the day, the hour, which occurrence of the weekday, and which rule fired.                                              |

Third-party-dependent tests carry a ⚠️ at the top of their file, and their failure messages always say
so. Identifying such a failure should never require reading the implementation.
