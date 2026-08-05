# `github-uptime`

> [!NOTE]
> **Depends on a third party.** It fails during a real GitHub incident. Confirm at <https://www.githubstatus.com> before treating a failure as ours.
>
> [`apps/README.md`](../README.md) frames the live scenarios. [`CONTRIBUTING.md`](../../CONTRIBUTING.md) has `APPS_UPTIME_THRESHOLD`.

## ⚠️ This scenario depends on a third party

**It fails during a real GitHub incident**, and that is deliberate. See "telling the two apart" below
before treating a failure here as a problem with this repo.

## What this scenario demonstrates

A real external dependency causing real intermittency.

Every other story here is something we made happen. This one is not: its outcome tracks whether GitHub
is actually up, read from the public status endpoint that exists to be polled.

No generator produces this. Real dependencies fail in shapes nobody thinks to simulate, at times
nobody would pick, and for durations nobody would choose — a 40-minute partial degradation at 06:00 on
a Tuesday is not a distribution anyone writes down.

## Telling "the monitor worked" from "we have a problem"

1. Open **<https://www.githubstatus.com>** — the same page this test reads.
2. If GitHub is degraded, the monitor worked. Nothing here is broken.
3. If GitHub is fine but this is failing, the failure message says which of two things happened:
   - **the request did not complete** — network or DNS on the runner;
   - **the status was at or above the threshold** — the page and this test disagree, which is worth a
     look.

## The story in this folder

| Test                                                 | Behavior                                                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `healthcheck_always_passes`                          | Never fails, never touches the network. Separates "the dependency is down" from "our suite is down", which are otherwise the same red. |
| `github_is_not_reporting_a_major_incident`           | Fails when GitHub reports degradation at or above the threshold, or when the status cannot be read.                                    |
| `the_severity_threshold_orders_indicators_correctly` | Asserts the severity ladder offline. Always passes, so the threshold's meaning is documented without waiting for an outage.            |

Both failure modes are legitimate answers to "can I depend on GitHub right now" — which is the question
every test that depends on GitHub is implicitly asking, every time it runs.

## Cadence

Called **once per test run**, never in a loop, with a 10-second timeout and a user-agent identifying
this repository. The endpoint is Statuspage's summary JSON, which exists to be polled — but hourly is
already generous, and no version of this story needs it more often.

## What you should see in the product

| When                     | What                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Most of the time         | Three green tests, and a log line with GitHub's current status.                                                                              |
| During a GitHub incident | One failure, for as long as the incident lasts, resolving when it does.                                                                      |
| Over months              | A failure history that matches GitHub's published incident history — which is a more interesting thing to look at than any generated series. |

Expect long quiet stretches. GitHub is up most of the time, so this test contributes almost nothing on
most days and everything on a few.

## Configuration

| Variable                | Default | Effect                                                        |
| ----------------------- | ------- | ------------------------------------------------------------- |
| `APPS_UPTIME_THRESHOLD` | `major` | Minimum severity that fails: `minor`, `major`, or `critical`. |

`minor` makes this fire considerably more often — Statuspage reports minor degradations fairly
routinely — which is the honest way to make the scenario more active without polling harder.
