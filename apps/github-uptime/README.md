# `github-uptime`

> [!NOTE]
> **Depends on a third party.** This fails during a real GitHub incident. Confirm at
> <https://www.githubstatus.com> — the same page the test reads — before treating a failure as ours.

## What this demonstrates

A real external dependency causing real intermittency. Every other story here is something we made
happen; this one tracks whether GitHub is actually up.

No generator produces this. Real dependencies fail in shapes nobody thinks to simulate, at times nobody
would pick, for durations nobody would choose — a 40-minute partial degradation at 06:00 on a Tuesday is
not a distribution anyone writes down.

## Telling the two apart

1. Open <https://www.githubstatus.com>.
2. If GitHub is degraded, the monitor worked.
3. If it is fine, the failure message says which of two things happened: the request did not complete
   (network or DNS on the runner), or the status was at or above `major` (the page and this test
   disagree, which is worth a look).

`healthcheck always passes` never touches the network, so it separates "the dependency is down" from "our
suite is down" — otherwise the same red.

## Cadence

Once per run, never in a loop, with a 10-second timeout and a user-agent identifying this repository. The
endpoint is Statuspage's summary JSON, which exists to be polled, but hourly is already generous.

## What you should see

Long quiet stretches. GitHub is up most of the time, so this contributes almost nothing on most days and
everything on a few. Over months, a failure history that matches GitHub's published incidents — which is
more interesting than any generated series.
