# `pass-on-retry`

> [!NOTE]
> <https://docs.trunk.io/flaky-tests/detection/pass-on-retry-monitor>

A test that **failed and then passed on the same commit** — the least deniable flakiness signal there
is. Failing on one commit and passing on the next has an ordinary explanation; doing both on the same
code has none.

## Two ways a pair forms, one story each

A pair needs a failing run and a passing run of the same test on the same commit. It does not matter
whether they arrive together or separately, and this folder demonstrates both.

**Within one upload** — [`retry-ladder.spec.ts`](retry-ladder.spec.ts), playwright with three retries:

| Test                                            | Behavior                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| `passes on the first attempt`                   | The control. Never retried, so never pairs.         |
| `passes on the second attempt`                  | Fails once, then passes.                            |
| `passes on the third attempt`                   | Fails twice, then passes.                           |
| `passes on the fourth attempt`                  | Fails three times, then passes.                     |
| `never passes however many times it is retried` | Fails every attempt. **Not** a pair — the boundary. |

Playwright retries the test and reports every attempt; `includeRetries: true` on its built-in JUnit
reporter puts each one in the XML as its own run, as `flakyFailure`/`flakyError` for a test that
eventually passed and `rerunFailure`/`rerunError` plus a final failure for one that never did. So a
single upload carries both halves.

`never passes…` is what stops the demo overclaiming: without it, a viewer could conclude the monitor
flags anything that gets retried.

**Across uploads** — [`canonical.test.ts`](canonical.test.ts), vitest, no retries:

| Test                                       | Behavior           |
| ------------------------------------------ | ------------------ |
| `fails 1 percent, pairing across uploads`  | Fails 1% of runs.  |
| `fails 10 percent, pairing across uploads` | Fails 10% of runs. |

Scheduled runs report against the same head commit hour after hour, because the default branch does not
move hourly. So a test that fails one hour and passes the next has failed and passed on the same commit
— a pair assembled from two separate uploads.

The rates are deliberately low. At 1% the test looks healthy by any failure-rate measure, and the pair
is the only thing that says otherwise. That is the case this monitor exists for.

## What you should see

Within the hour, three pairs from the ladder in a single upload. The cross-upload pairs take longer,
since they need the test to land on both sides of the same commit — the 10% one within a day, the 1% one
over several.

The PR factory also contributes commits of its own, so pairs appear against pull-request commits as well
as against the default branch.

## One known gap

Playwright's built-in JUnit reporter writes `classname` but no `file` attribute, and the uploader uses
`file` to correlate a test with its code owner. So the uploader reports one warning for this report and
cannot attribute these tests to an owner.

It costs nothing today — `monitors/` has no per-package CODEOWNERS rules, so everything here resolves to
the default owner regardless. It would matter if per-monitor owners were ever added.
