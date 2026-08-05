# `synth/branch-rates` — the same test, one rate per branch

## What this demonstrates

Branch-filtered monitor configuration. The four tests here have **identical identities on every
branch** — same name, same classname, same file, same suite — so the only thing that differs
between runs is the branch they arrived on. Point a monitor at `main` and the test looks quiet;
point the same monitor at `release/*` and the same test is noisy.

| Branch                     | Arrives as | Default rate | Why it is here                                                                               |
| -------------------------- | ---------- | ------------ | -------------------------------------------------------------------------------------------- |
| `main`                     | `PB`       | 4%           | The quiet baseline everything else is read against.                                          |
| `gh-readonly-queue/main/…` | `MERGE`    | 9%           | Merge-queue runs, which the uploader classes separately from the branch they are queued for. |
| `release/1.4.2`            | `NONE`     | 22%          | Matches `release/*` **and** `release/?.?.?`.                                                 |
| `release/2.0.0.beta`       | `NONE`     | 38%          | Matches `release/*` **and** `release/*.beta`, but not `release/?.?.?`.                       |
| `feature/promo-codes`      | `PR`       | 55%          | Unreviewed work, with a fabricated PR number.                                                |

## Why there are two release branches

`release/*`, `release/?.?.?`, and `release/*.beta` are three different filters, and with only one
release branch two of them are indistinguishable in the data:

|                      | `release/*` | `release/?.?.?` | `release/*.beta` |
| -------------------- | ----------- | --------------- | ---------------- |
| `release/1.4.2`      | matches     | matches         | no               |
| `release/2.0.0.beta` | matches     | no              | matches          |

So the second release branch is not decoration. It is what makes the difference between those
filters observable.

## The `NONE` in that table is deliberate, and worth understanding

`release/*` looks like a protected-branch pattern, but the uploader matches configured protected
branches **exactly** — not by glob. `release/1.4.2` is not protected unless your org has
configured that literal string, so these runs arrive as `NONE`.

This is the most common reason a run intended as `PB` shows up as `NONE`. Branch _name_ filtering
in a monitor still works fine on these branches; it is only the branch _class_ that differs. If
you want the release legs classed as `PB`, add their exact names to `SYNTH_PROTECTED_BRANCHES` —
and to your org's protected branches, so the two agree.

## Branch class is derived, not set

Configuration here expresses a desired class and the generator produces naming that yields it. The
precedence, and the reason only legal combinations are expressible in code:

| Target  | How it is produced                        | Caveat                                          |
| ------- | ----------------------------------------- | ----------------------------------------------- |
| `MERGE` | branch carries a merge-queue prefix       | Wins over everything, including a set PR number |
| `PR`    | set the PR-number override to any integer | No real pull request needed                     |
| `PB`    | branch exactly matches a protected branch | Warns if a PR number is also set                |
| `NONE`  | anything else                             | The fallthrough                                 |

Each leg also gets its own fabricated commit. The protected leg and the merge-queue leg share a
branch name, and if they shared a commit their runs would be paired with each other as
pass-on-retry candidates — a detection nobody asked for, in a folder that is not telling that
story.

## What you should see in the product

| When           | What                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Within an hour | Five runs of the same five tests, one per branch, each with a different branch and class.                                                                         |
| Within a day   | 24 runs per branch, enough for the configured rates to separate visibly.                                                                                          |
| Day 2 onward   | A failure-rate monitor filtered to `main` stays quiet while the same monitor filtered to `release/*` or to pull requests fires. That contrast is the whole story. |

Four tests over 24 hourly runs is 96 samples per branch per day, so a 4% branch and a 22% branch
are cleanly distinguishable within a day — but a single hour's run is not a sample worth reading.

## Configuration

| Variable                           | Default               | Effect                                               |
| ---------------------------------- | --------------------- | ---------------------------------------------------- |
| `SYNTH_BRANCH_RATE_PROTECTED`      | 4                     | Failure rate on the protected branch.                |
| `SYNTH_BRANCH_RATE_MERGE_QUEUE`    | 9                     | Failure rate on merge-queue runs.                    |
| `SYNTH_BRANCH_RATE_RELEASE_SEMVER` | 22                    | Failure rate on the numbered release branch.         |
| `SYNTH_BRANCH_RATE_RELEASE_BETA`   | 38                    | Failure rate on the pre-release branch.              |
| `SYNTH_BRANCH_RATE_PULL_REQUEST`   | 55                    | Failure rate on pull-request branches.               |
| `SYNTH_BRANCH_RELEASE_SEMVER`      | `release/1.4.2`       | Must match `release/?.?.?`.                          |
| `SYNTH_BRANCH_RELEASE_BETA`        | `release/2.0.0.beta`  | Must match `release/*.beta` and not `release/?.?.?`. |
| `SYNTH_BRANCH_PULL_REQUEST`        | `feature/promo-codes` | Pull-request branch name.                            |

Keep the rates ordered — protected lowest, pull request highest. A protected branch failing as
often as a pull-request branch is not a story anyone learns anything from.

Renaming a branch does **not** change test identity, so history carries over; the runs simply start
arriving under the new branch name. Renaming a release branch so that it no longer matches the
filter it was chosen for does silently break the comparison, which is why the constraints are in
the table above.

## Related

- [`../README.md`](../README.md) — how `synth/` works and how to verify it locally
- [`../cohorts/README.md`](../cohorts/README.md) — the other protected-branch story
- [`../../README.md`](../../README.md) — the monitor catalog
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — every variable
