# `pass-on-retry`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/pass-on-retry-monitor>

A test that **failed and then passed on the same commit** — the least deniable flakiness signal there is.
Failing on one commit and passing on the next has an ordinary explanation; doing both on the same code
has none.

## The story

[`retry-ladder.spec.ts`](retry-ladder.spec.ts), playwright with three retries.

| Test                                            | Behavior                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| `passes on the first attempt`                   | The control. Never retried, so never pairs.         |
| `passes on the second attempt`                  | Fails once, then passes.                            |
| `passes on the third attempt`                   | Fails twice, then passes.                           |
| `passes on the fourth attempt`                  | Fails three times, then passes.                     |
| `never passes however many times it is retried` | Fails every attempt. **Not** a pair — the boundary. |

The last one stops the demo overclaiming: without it, a viewer could conclude the monitor flags anything
that gets retried. The attempt counts are in the names because they are properties of the code.

## Why there is a custom reporter

**Playwright's built-in JUnit reporter collapses retries.** A test that failed twice and then passed
becomes a single `<testcase>` with no failure element; the earlier attempts survive only as prose in a
`<system-out>` CDATA block. Verified against `@playwright/test` 1.62. Pass-on-retry is undetectable from
that — if the failing attempts are not in the XML as runs, there is nothing to pair.

[`junit-reporter.ts`](junit-reporter.ts) emits the elements the parser reads instead: `<flakyFailure>` per
failed attempt of a test that eventually passed, and `<rerunFailure>` plus a final `<failure>` for one
that never did.

## Why one upload matters

Pairs form only inside a trailing window of a few hours, and the threshold counts _distinct commits_. A
ladder spread across five hourly runs never completes — the earliest pairs age out before the last lands.
Finishing inside one run removes the problem rather than managing it.

The distinct commits come from the **PR factory**, not the schedule: `main` does not move hourly, so the
schedule alone supplies one commit no matter how often it runs. **If detections are not appearing, check
`PR_FACTORY_TOKEN` first** — see [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## What you should see

Three tests with both a failure and a pass on one commit, from a single upload, within the hour. Enough
distinct commits for a pair-count threshold within about six hours. This is the story most sensitive to
the schedule slipping, because its window is the shortest in the repo.
