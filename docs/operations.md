# Operations

This repo is watched, not just read. The runs that make the demo compelling are the same runs the
owning team alerts on, so an outage here and a story here look alike until you check.

## Cadence

One hourly scheduled workflow ([`hourly.yaml`](../.github/workflows/hourly.yaml)) runs `synth/`,
`monitors/`, and `apps/`, and also drives the PR factory. A second workflow
([`pr.yaml`](../.github/workflows/pr.yaml)) runs `monitors/` and `apps/` on every pull request. There are deliberately **no per-folder schedules** — a single cadence is what keeps the
evaluation windows below satisfiable, and `synth/` volume is tuned by its scale variables rather
than by running more often.

## Three ways detection fails silently

Each of these makes the runs look correct while the monitor simply never fires. All three shaped
the implementation.

### 1. Pass-on-retry is evaluated over a trailing window of a few hours

A pass-on-retry pair is a passing run and a failing run **for the same commit**, and pairs are
only formed from recent runs — a trailing window of roughly six hours.

Two consequences:

- The schedule must stay well under that window. Hourly is comfortable.
- **A single pass-on-retry story must complete inside one window.** The pair-count threshold
  counts _distinct commits_, so a ladder of five pairs cannot be spread across five hourly runs:
  the earliest pairs age out before the fifth lands. The story has to produce its whole ladder in
  one run, which is why it is a Playwright test reporting all of its own retries rather than a
  multi-run retry dance.

### 2. Missing runs resolve monitors

Several monitors treat "no recent runs for this test" as grounds to resolve as stale, measured
against wall clock rather than against run count. A dropped or delayed scheduled run wider than
that threshold resolves the monitor.

Scheduled workflows are best-effort — GitHub delays and drops them under load. So stale thresholds
must be set generously relative to the hourly cadence, or our own infrastructure flakiness becomes
indistinguishable from the story being told.

This is also why every `monitors/` package carries a healthcheck test that always passes. It
distinguishes _"the monitor fired"_ from _"the suite stopped reporting."_ If the healthcheck is
present and green, absence of data elsewhere is a story; if the healthcheck is missing too, it is
an outage.

### 3. Retention caps every long arc

Run history ages out after roughly 60 days, and pass-on-retry history sooner.

Consequence: **express every window relative to now, never as an absolute date.** A story written
against a fixed date silently rots, and a fork of it is born already rotten.

## The PR factory

Each hourly run opens a pull request with a trivial, self-evidently inert change, lets `pr.yaml`
upload results attributed to it, and then **closes the previous run's PR** — closed, never merged —
and deletes its branch. Nothing ever lands, so the trivial change cannot accumulate.

Closing last hour's PR rather than the one just opened gives `pr.yaml` a full hour to finish.
Closing immediately would race the checks. The prior PR is found by the label the factory applies,
not by number arithmetic.

### The token requirement, which is the most likely thing to be wrong

**The factory does not work with the default workflow token.** Events created using the default
`GITHUB_TOKEN` do not trigger further workflow runs, so a PR opened with it will never fire
`pr.yaml`, and no PR-attributed data will ever appear.

Use a token from the org's own GitHub App (preferred) or a PAT, stored as the `PR_FACTORY_TOKEN`
secret. If you are debugging "the factory runs but no PR data appears," check this first.

## Fork pull requests have no secrets

This repository is public and will receive outside pull requests. Those runs have no access to
repository secrets, so they cannot upload. Every upload step detects the missing token and **skips
with a clear log line rather than failing the job** — a red X on a contributor's PR because our
demo could not upload would be a bug, not a signal.

## Why a red run here means something is actually wrong

Quarantining is deliberately **off** for every upload. Two reasons, and the second is the operational
one:

- Every failure in this repo is a story. A quarantined failure is a story that stopped being told.
- With quarantining off and the test process's exit code not forwarded, the upload step's status
  reflects **upload health only**. Deliberate test failures do not turn the job red, so a red hourly
  run means something is genuinely broken. That is what makes this usable as a canary rather than as
  a wall of expected red.

The scheduled workflow runs at **:17**, not on the hour. GitHub queues scheduled workflows across
every repository on the platform and the top of the hour is the worst minute to ask for one. Delays
there are routine and long, and since missing runs resolve monitors, a queueing delay would look
exactly like a story.

## When data stops arriving

In order — each step is cheaper than the one after it.

1. **Is the hourly workflow still scheduled?** GitHub disables scheduled workflows on repositories
   with no activity for 60 days. This is the most common cause of a demo that "used to work."
2. **Did the run succeed but skip its upload?** Every upload step logs a notice when it skips, naming
   the reason: no API token (expected on pull requests from forks), or an unset collection ID.
   A skip is never a failure, so it will not be red.
3. **Is `PR_FACTORY_TOKEN` still valid?** If PR-attributed data specifically is missing while
   scheduled data arrives, this is almost certainly why. See above.
4. **Are the healthcheck tests reporting?** Every `monitors/` package and every `synth/` generator
   emits one that always passes and never retires. If the healthchecks are green, absence elsewhere is
   an intentional retirement rather than an outage. If they are absent too, it is an outage.
5. **Did a generator produce zero uploads?** That is a legitimate outcome — every cohort may have
   retired — and it is logged as a count rather than treated as an error. Check the count in the
   `synth` job's summary before assuming a crash.

## Deliberately alarming stories, and how to tell them apart from incidents

Everything in this repo that can look like an incident is listed here with the condition that
triggers it, so an alert can be triaged in one lookup rather than by reading code.

| Story                                                         | Trigger                                                                                                                      | Why it looks like an incident                                                                                                                | How to confirm in one step                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`apps/mass-detection`](../apps/mass-detection/README.md)     | **Day 13 of every month, UTC** (`APPS_MASS_DETECTION_DAY_OF_MONTH`)                                                          | Twenty tests in one suite fail together, in the same run, all day. That is exactly what a bad deploy or an infrastructure change looks like. | Check the date. Also: its healthcheck stays green, so the suite has not died.                                         |
| [`apps/third-party-apis`](../apps/third-party-apis/README.md) | GitHub's unauthenticated rate limit exhausted for the runner's IP — 60/hour, **shared with everything else on the platform** | Two tests fail in the same run and recover together at the top of the hour. Reads like a broken integration.                                 | The failure message names the cause: rate limited, request failed, or budget unreadable. Only the first is the story. |
| [`apps/github-uptime`](../apps/github-uptime/README.md)       | A real GitHub incident at or above `APPS_UPTIME_THRESHOLD` (`major` by default)                                              | It is a real outage — just not ours.                                                                                                         | Open <https://www.githubstatus.com>, the same page the test reads.                                                    |
| [`apps/parking-meter`](../apps/parking-meter/README.md)       | Weekdays and Saturday, 08:00–18:00 UTC                                                                                       | Nothing, once you look at _when_. Listed because a 42% failure rate looks like ordinary flakiness until you do.                              | The failure message prints the day, the hour, and the schedule.                                                       |
| [`monitors/*`](../monitors/)                                  | Continuously, by design                                                                                                      | Deliberate failures at configured rates.                                                                                                     | Every deliberate failure message ends with "This is the demo working, not a broken test."                             |

**A change to a trigger variable can fire an event immediately.** Setting
`APPS_MASS_DETECTION_DAY_OF_MONTH` to today starts twenty failures on the next run. That is not a bug,
but it will page somebody.

## Related

- [`configuration.md`](configuration.md) — the variables and secrets named above
- [`monitors.md`](monitors.md) — what each monitor should show, and when
- [`architecture.md`](architecture.md) — how uploads are wired
