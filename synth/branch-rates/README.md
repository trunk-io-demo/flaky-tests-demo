# `synth/branch-rates` — the same test, one rate per branch

Branch-filtered monitor configuration. The four tests here have **identical identities on every branch**,
so the only thing that differs between runs is the branch they arrived on — which is exactly what a branch
filter selects on. Point a monitor at `main` and the test looks quiet; point the same monitor at
`release/*` and it is noisy.

| Branch                     | Arrives as | Rate | Why it is here                                       |
| -------------------------- | ---------- | ---- | ---------------------------------------------------- |
| `main`                     | `PB`       | 4%   | The quiet baseline.                                  |
| `gh-readonly-queue/main/…` | `MERGE`    | 9%   | Classed separately from the branch it is queued for. |
| `release/1.4.2`            | `NONE`     | 22%  | Matches `release/*` **and** `release/?.?.?`.         |
| `release/2.0.0.beta`       | `NONE`     | 38%  | Matches `release/*` **and** `release/*.beta`.        |
| `feature/promo-codes`      | `PR`       | 55%  | Unreviewed work, with a fabricated PR number.        |

Each case runs at a weight of the branch's rate — 50%, 100%, 150%, 200% — so the four are not four
identical tests.

## Why two release branches

`release/*`, `release/?.?.?`, and `release/*.beta` are three different filters, and with one release branch
two of them are indistinguishable in the data:

|                      | `release/*` | `release/?.?.?` | `release/*.beta` |
| -------------------- | ----------- | --------------- | ---------------- |
| `release/1.4.2`      | matches     | matches         | no               |
| `release/2.0.0.beta` | matches     | no              | matches          |

## The `NONE` is deliberate

`release/*` looks like a protected-branch pattern, but the uploader matches configured protected branches
**exactly**, not by glob. So these arrive as `NONE`.

This is the most common reason a run intended as `PB` shows up as `NONE`. Branch _name_ filtering still
works on them; only the _class_ differs. Add their exact names to `SYNTH_PROTECTED_BRANCHES` — and to your
org's protected branches — if you want them classed as `PB`.

## Branch class is derived, not set

| Target  | Produced by                               | Caveat                                          |
| ------- | ----------------------------------------- | ----------------------------------------------- |
| `MERGE` | a merge-queue prefix on the branch        | Wins over everything, including a set PR number |
| `PR`    | a PR-number override, any integer         | No real pull request needed                     |
| `PB`    | a branch exactly matching a protected one | Warns if a PR number is also set                |
| `NONE`  | anything else                             | The fallthrough                                 |

Only the legal pairs are constructible in code, since illegal ones produce validation warnings that look
bad on screen mid-demo. Each leg also gets its own fabricated commit: the protected and merge-queue legs
share a branch name, and sharing a commit would make their runs pass-on-retry candidates for each other.

## What you should see

Five runs of the same five tests within the hour, one per branch. Within a day, 96 samples per branch —
enough for 4% and 22% to separate cleanly, though a single hour is not a sample worth reading. From day
two, a failure-rate monitor filtered to `main` stays quiet while the same monitor filtered to `release/*`
fires on the same test.

## Configuration

`SYNTH_BRANCH_RATE_{PROTECTED,MERGE_QUEUE,RELEASE_SEMVER,RELEASE_BETA,PULL_REQUEST}` set the rates; keep
them ordered, protected lowest. `SYNTH_BRANCH_RELEASE_SEMVER` and `SYNTH_BRANCH_RELEASE_BETA` set the
branch names and must keep matching the globs they were chosen to distinguish.
