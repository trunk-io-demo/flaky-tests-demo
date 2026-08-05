# Conventions for `monitors/`

## Keep the indexes current

**Every test in this directory is listed twice**, and both listings are part of the deliverable
rather than a nicety — the whole point of this repo is that a reader can find the story a monitor
belongs to without reading code.

When you add, rename, or remove a test:

1. Update the table in that package's own `README.md`.
2. Update the index in [`README.md`](README.md) here.

A test that exists but is not indexed is invisible. A test that is indexed but does not exist is
worse — it sends a reviewer looking for a story that is not there.

## Naming

- **Test names are lowercase words separated by spaces.** `it("healthcheck always passes")`, not
  `healthcheck_always_passes` or `healthcheckAlwaysPasses`. Kebab is acceptable inside a token that
  is genuinely one word (`pass-on-retry`, a date like `2026-08-05`); nothing else.
- **Names carry no numbers that live in configuration.** `fails on a low rate`, not
  `fails 10 percent of runs` — the rate is a repository variable, so a name with the number in it
  starts lying the first time somebody tunes the demo. Numbers live in the package README.
  The attempt counts in `pass-on-retry` are the deliberate exception: those are properties of the
  code, not of config.
- **Names describe the mechanism, not the outcome**, wherever tuning can change the outcome.
  `burst member 03` rather than `always fails 03`.

## Renaming anything is a history-losing operation

Test identity is derived from repository, `file`, `classname`, suite, name, and variant. Renaming a
test, a file, or a directory therefore creates a **new** test in the product and orphans the old
one's history.

That is free before a story's first upload and expensive afterwards. If you are renaming something
that has already been reporting, say so in the commit message so the gap in the data is
attributable.

## Every package has a healthcheck

One test that always passes and never skips, named `healthcheck always passes`, asserting
`expect(1).toBe(1)` and nothing else.

It is not decoration. Several monitors resolve when a test stops reporting, so "the monitor
resolved" and "the suite stopped running" look identical from outside. A green healthcheck is what
separates them, which is why it must have no other reason to fail — an assertion about the clock or
the environment is one more thing that can break and destroy the signal.

## Outcomes are seeded, never random

A story has to differ between runs to have a rate at all, and has to be reproducible for a fork to
tell the same story. `Math.random()` gives up the second; a fixed outcome gives up the first.

So outcomes come from a seeded generator keyed on the test name and the current UTC hour. Every
deliberate failure message prints its rate and its bucket, so any failure can be traced back to a
decision rather than to chance.

## Shared helpers live in `utils/`

[`utils/`](utils/) holds what the stories share, in three files:

| File        | Holds                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| `ci.ts`     | `getBranch`, `getPrNumber`, `getBranchClass`, `protectedBranches`.                       |
| `when.ts`   | `getDay`, `getDate`, `getEpochDay`, `isEveryOtherDay`, `MONDAY`. All UTC.                |
| `random.ts` | `randomPercentage`, `ratePercent`, `intFromEnv`, and the hash and generator behind them. |

Depend on it with `"@flaky-tests-demo/monitors-utils": "workspace:*"`. It is a workspace member but
not a monitor: it has no tests, so `pnpm --filter --if-present` skips it in CI.

Two rules for it:

- **`getBranchClass()` is the way to ask where a run came from.** It reproduces the uploader's
  precedence, including that a merge-queue branch is `MQ` even when a PR number is also set. Rolling
  your own check produces a story that fails on the wrong runs and a name that claims something else.
- **Everything in `when.ts` is UTC.** A local timezone makes a periodic story depend on where the
  runner is and on daylight saving, turning a clean pattern into an almost-periodic one.

`junit-reporter.ts` is the one thing still copied per package rather than shared, because a playwright
reporter is resolved by path from its config and a cross-package path couples two stories together.
Keep the copies byte-identical so a `diff` is a meaningful check.

## Configs

- **`*.test.ts` is vitest, `*.spec.ts` is playwright.** Both configs declare explicit
  include/exclude, because with no language directory between them each runner's default glob claims
  both file sets.
- **Both configs root themselves at the repository**, not the package. `file` and `classname` are
  resolved against the root and both feed identity — rooted at the package, every
  `canonical.test.ts` reports the same values and the seven healthchecks collide into one test.
- **`addFileAttribute: true` on the vitest junit reporter.** It is off by default, and without it
  there is no `file` attribute for CODEOWNERS to match.
- Keep the comments in these files short. They explain the two non-obvious lines and nothing more.

## Deliberate failures announce themselves

Every intentional failure message ends by saying so — "This is the demo working, not a broken test."
Somebody triaging an alert at 03:00 should not have to open the source to find out whether the
failure was on purpose.

## Adding a package needs no CI edit

The composite action iterates workspace members with `pnpm --filter`. A new directory with a `test`
script is picked up by the next scheduled run, provided it is matched by the globs in
`pnpm-workspace.yaml`. If you are editing a workflow to add a story, something has drifted.
