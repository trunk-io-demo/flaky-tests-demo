# `pass-on-retry`

> [!NOTE]
> **Docs:** [Pass on retry monitor](https://docs.trunk.io/flaky-tests/detection/pass-on-retry-monitor)

A test that **failed and then passed on the same commit** — the least deniable flakiness signal there
is. Failing on one commit and passing on the next has an ordinary explanation; doing both on the same
code has none.

## Prototypical examples

| Test                                                            | Why this one                                                                              | Production                                                                                                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`passes on the second attempt`](retry-ladder.spec.ts)          | Playwright retries. One failure and a pass in one upload, on one commit.                  | [history](https://app.trunk.io/flaky-tests-demo/flaky-tests/collections/oQbZIsKc/tests/31fd0870-eb39-48c0-b2a6-a3e3643e5f07_d8b92121-0b58-5d70-8099-6aced63e3715?tab=history) |
| [`fails 10 percent, pairing across uploads`](canonical.test.ts) | A percentage-based failure rate, pairing across two separate runs rather than within one. | [test](https://app.trunk.io/flaky-tests-demo/flaky-tests/collections/oQbZIsKc/tests/31fd0870-eb39-48c0-b2a6-a3e3643e5f07_a336b5fb-e66d-55d3-a116-6773c711297e)                |

## Two ways a pair forms, one story each

A pair needs a failing run and a passing run of the same test on the same commit. It does not matter
whether they arrive together or separately, and this folder demonstrates both.

**Within one upload** — [`retry-ladder.spec.ts`](retry-ladder.spec.ts), playwright with three retries:

| Test                           | Behavior                                            |
| ------------------------------ | --------------------------------------------------- |
| `passes on the first attempt`  | The control. Never retried, so never pairs.         |
| `passes on the second attempt` | Fails once, then passes.                            |
| `passes on the third attempt`  | Fails twice, then passes.                           |
| `passes on the fourth attempt` | Fails three times, then passes.                     |
| `never passes`                 | Fails every attempt. **Not** a pair — the boundary. |

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
| `fails 25 percent, pairing across uploads` | Fails 25% of runs. |

Scheduled runs report against the same head commit hour after hour, because the default branch does not
move hourly. So a test that fails one hour and passes the next has failed and passed on the same commit
— a pair assembled from two separate uploads.

A ladder rather than one rate, because how often a pair forms is the thing that varies. At 1% the test
looks healthy by most failure-rate measures and the pair is the only thing that says otherwise, which is
the case this monitor exists for; at 25% there is reliably one to point at.

## What you should see

Within the hour, three pairs from the ladder in a single upload. The cross-upload pairs take longer,
since they need the test to land on both sides of the same commit — the 25% one within hours, the 10% one
within a day, the 1% one over several.

The PR factory also contributes commits of its own, so pairs appear against pull-request commits as well
as against the default branch.

## Other monitors

| Monitor                                               | How it overlaps                                                                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`timeout-inflation`](../timeout-inflation/README.md) | A timeout that succeeds on a second go is the classic pair, and the two halves have wildly different durations — milliseconds against the ceiling. Reading a pair's durations tells you which kind of flake it was. |
| [`failure-rate`](../failure-rate/README.md)           | `never passes` sits at 100% and is never paired, while a 10% test pairs often. A rate monitor and this one disagree about which is worse, and both are right.                                                       |
| [`failure-count`](../failure-count/README.md)         | A test that fails and then passes contributes nothing to a failure count, since its final result is a pass. The count and the pair see different halves of the same run.                                            |
| [`skipped-test`](../skipped-test/README.md)           | Its cascade runs with retries off deliberately: with them on, the setup would get a second chance not to cascade and would pair here instead of skipping there.                                                     |

Real flakiness trips several monitors at once, so these overlaps are the point rather than a smell.
