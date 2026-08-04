# Forking this repo

Being cheap to fork is a goal, not a side effect. A demo runner should get their own copy of every
story by adjusting repository variables — never by editing test code or workflow YAML.

_Written against the finished repo in the documentation pass; the outline below is the shape it
will take._

## What you need before you start

Provisioned by a human, not by this repo:

- A Trunk org, with its slug and an API token.
- A GitHub org with the Trunk GitHub App installed.
- One test collection per top-level folder.

## What you must change

_The minimum set of variables, and the failure mode of forgetting each._

## What you probably want to change

_Rates, scale, and cadence._

## What you should not change

_The things that are load-bearing for the stories rather than tunable._

## Verifying your fork works

_What to look at, and how long after the first scheduled run._

## Related

- [`configuration.md`](configuration.md) — every variable and secret in one table
- [`operations.md`](operations.md) — the token requirement that most forks hit first
