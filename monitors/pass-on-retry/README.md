# `pass-on-retry`

> [!NOTE]
> **What this monitor does, in the product docs:**
> <https://docs.trunk.io/flaky-tests/detection/pass-on-retry-monitor>
>
> [`monitors/README.md`](../README.md) indexes every monitor story and [`CLAUDE.md`](../CLAUDE.md) has the conventions for changing them. [`CONTRIBUTING.md`](../../CONTRIBUTING.md) covers the PR factory.
>
> **If detections are not appearing, check `PR_FACTORY_TOKEN` first.** Scheduled runs all report against one commit, so the PR factory is the only source of the distinct commits this monitor needs.

## What this monitor detects

A test that **failed and then passed on the same commit**.

That pairing is what makes it the least deniable flakiness signal there is. A test that fails on one
commit and passes on the next has an ordinary explanation: somebody fixed something. A test that does
both on the same code has none. Nothing changed, so the test is not measuring what it claims to.

## The story in this folder

[`retry-ladder.spec.ts`](retry-ladder.spec.ts) is a playwright suite configured with three retries,
so up to four attempts.

| Test                                                                      | Behavior                                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `passes_on_the_first_attempt`                                             | The control. Never retried, so never pairs.                                                             |
| `passes_on_the_second_attempt`                                            | Fails once, then passes. One pair.                                                                      |
| `passes_on_the_third_attempt`                                             | Fails twice, then passes. Two failures, one pass.                                                       |
| `passes_on_the_fourth_attempt`                                            | Fails three times, then passes.                                                                         |
| `never_passes_however_many_times_it_is_retried`                           | Fails every attempt. **Not** a pass-on-retry pair — this is the boundary.                               |
| `healthcheck_always_passes` (in [`canonical.test.ts`](canonical.test.ts)) | Never fails. In vitest, not playwright, because a healthcheck that can be retried is not a healthcheck. |

The last two are what stop the demo from overclaiming. Without `never_passes…`, a viewer could
reasonably conclude the monitor flags anything that gets retried — which would make its detections
mean much less than they do.

The attempt counts **are** in these names, unlike the rates elsewhere in this repo, because they are
properties of the test's code rather than of configuration. Tuning cannot make them lie.

## Why this needs a custom reporter

Worth reading before changing anything here.

**Playwright's built-in JUnit reporter collapses retries.** A test that failed twice and then passed
is reported as a single `<testcase>` with no failure element at all; the earlier attempts survive
only as prose inside a `<system-out>` CDATA block. Verified against `@playwright/test` 1.62.

That makes pass-on-retry undetectable from its output. A pair needs a failing run and a passing run,
and if the failing attempts are not in the XML **as runs**, there is nothing to pair.

The JUnit dialect the parser reads does have elements for this, so
[`junit-reporter.ts`](junit-reporter.ts) emits them:

| Situation                         | Elements emitted                                               |
| --------------------------------- | -------------------------------------------------------------- |
| Failed some attempts, then passed | `<flakyFailure>` per failed attempt                            |
| Failed every attempt              | `<rerunFailure>` per earlier attempt, plus a final `<failure>` |
| Passed first time                 | nothing — a bare `<testcase>`                                  |

Those get expanded into separate run rows, so a **single upload** contains both halves of every pair.

### Why one upload matters so much here

Pass-on-retry pairs are only formed from runs inside a trailing window of a few hours, and the pair
threshold counts _distinct commits_. So a ladder spread across five hourly runs spanning ten hours
never completes — the earliest pairs age out before the last one lands.

Completing inside one run removes the problem entirely. Nothing has to be remembered across runs and
nothing can age out mid-story.

### Where the distinct commits come from

Scheduled runs all report against the same head commit, because `main` does not move hourly. So the
schedule alone supplies **one** distinct commit no matter how often it runs.

The [PR factory](../../CONTRIBUTING.md) is what supplies fresh ones: it opens a pull request every
hour, each with its own commit, and `pr.yaml` runs this ladder against it. **If pass-on-retry
detections are not appearing, the factory's token is the first thing to check** — the default workflow
token cannot trigger `pr.yaml` at all.

## What you should see in the product

| When            | What                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Within an hour  | Three tests with both a failure and a pass on one commit, from one upload.                                |
| Within ~6 hours | Enough distinct commits, via the PR factory, for a pair-count threshold to be met.                        |
| Ongoing         | `never_passes…` shows at 100% failure rate and is never paired, which is the boundary being demonstrated. |

Detection here is hours, not days — and it is also the story most sensitive to the schedule slipping,
because its window is the shortest in the repo.

## Deliberate overlap with other monitors

- **[`failure-rate`](../failure-rate/README.md)** — `never_passes…` sits at 100% and should be flagged
  by a rate monitor while pass-on-retry ignores it entirely. That disagreement is informative.
- **[`timeout-inflation`](../timeout-inflation/README.md)** — retried attempts have durations too, and
  a test that retries because it timed out looks different from one that retries because of a race.

## Configuration

Nothing here is tunable, on purpose. The attempt counts are the story, and `retries: 3` in
[`playwright.config.ts`](playwright.config.ts) has to stay at or above the deepest rung of the ladder
or the deepest test stops passing at all and silently becomes a second `never_passes…`.
