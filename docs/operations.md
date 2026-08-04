# Operations

This repo is watched, not just read. The runs that make the demo compelling are the same runs the
owning team alerts on, so an outage here and a story here look alike until you check.

## Cadence

One hourly scheduled workflow runs `synth/`, `monitors/`, and `app/`, and also drives the PR
factory. There are deliberately **no per-folder schedules** — a single cadence is what keeps the
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

## When data stops arriving

_Checklist populated as the CI wiring lands._

1. Is the hourly workflow still scheduled? GitHub disables scheduled workflows on repositories
   with no activity for 60 days.
2. Did the run succeed but skip its upload? Look for the skip log line — a missing token, a
   missing collection ID, or a fork PR all skip rather than fail.
3. Is the PR factory's token still valid? See above.
4. Are the healthcheck tests reporting? If they are, absence elsewhere is intentional retirement,
   not an outage.

## Deliberately alarming stories, and how to tell them apart from incidents

_Populated as the stories land. Anything in this repo that looks like an incident is listed here
with the date or condition that triggers it, so that an alert can be triaged in one lookup._

| Story | Trigger | Why it looks like an incident |
| ----- | ------- | ----------------------------- |

## Related

- [`configuration.md`](configuration.md) — the variables and secrets named above
- [`monitors.md`](monitors.md) — what each monitor should show, and when
- [`architecture.md`](architecture.md) — how uploads are wired
