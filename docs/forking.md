# Forking this repo

Being cheap to fork is a goal, not a side effect. A demo runner should get their own copy of every
story by changing **repository variables**, never by editing test code or workflow YAML.

If you find yourself editing a `.yaml` file to make a fork work, that is a bug in this repo. The
predecessor repo bakes collection IDs into workflow files, so a fork uploads into the original's
collections until somebody edits YAML. That is the specific mistake this layout exists not to repeat.

## What you need before you start

Provisioned by a human. This repo creates none of it and will not invent any of it.

- A **Trunk org**, with its URL slug and an API token.
- A **GitHub org** with the Trunk GitHub App installed.
- **One test collection per top-level folder** — `synth`, `monitors`, `app` — and their 8-character
  IDs.
- A **GitHub App token or PAT** for the PR factory. Not the default workflow token; see below.

## The five values you must change

Nothing works until these are set. Each row includes the failure mode of forgetting it, because every
one of them fails quietly rather than loudly.

| Set                        | Kind   | If you forget                                                                              |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `TRUNK_ORG_SLUG`           | var    | Uploads are rejected. This one at least fails visibly.                                     |
| `TRUNK_API_TOKEN`          | secret | Every upload **skips with a log line** and the job stays green. Data simply never appears. |
| `SYNTH_TEST_COLLECTION`    | var    | `synth/` uploads skip. Same silence.                                                       |
| `MONITORS_TEST_COLLECTION` | var    | `monitors/` uploads skip.                                                                  |
| `APP_TEST_COLLECTION`      | var    | `app/` uploads skip.                                                                       |

A skipped upload is deliberately not a failure — a fork PR from an outside contributor must not go red
because our demo could not upload. The cost of that choice is that a misconfigured fork looks healthy.
**Check for the skip notices in the first run's logs.**

### The one that catches everybody

`PR_FACTORY_TOKEN` must be a GitHub App token or a PAT. **Events created with the default
`GITHUB_TOKEN` do not trigger further workflow runs**, so a pull request opened with it never fires
`pr.yaml` and no pull-request-attributed data ever appears.

The symptom is specific and confusing: the factory job goes green, pull requests appear and get closed
on schedule, and yet nothing PR-attributed shows up. If you are debugging that, this is why. See
[`operations.md`](operations.md).

It also matters more than it looks. Scheduled runs all report against the same head commit, because
your default branch does not move hourly — so the factory is the _only_ source of distinct commits,
and [`monitors/pass-on-retry`](../monitors/pass-on-retry/README.md) needs distinct commits to form
pairs at all.

## What you probably want to change

- **`TRUNK_API_ADDRESS`** if you are pointing at a different environment.
- **Rates.** Every `*_FAILURE_RATE`, `*_RATE_*`, and `MONITORS_FAILURE_COUNT` is safe to move. Raising
  them makes the demo louder at no cost.
- **`SYNTH_COHORT_BIRTH_INTERVAL_DAYS`** if 40 synthetic tests is more than you want.
- **`APP_MASS_DETECTION_DAY_OF_MONTH`**, so your fork's monthly event does not land on the same day as
  everyone else's. Do not set it to today unless you want it to fire immediately.

Every variable, with its default and its effect, is in [`configuration.md`](configuration.md).

## What you should not change

These are load-bearing for the stories rather than tunable. A reasonable-looking change to any of
them silently removes a demonstration.

| Leave alone                                                                   | Because                                                                                             |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `SYNTH_COHORT_LONG_WINDOW_DAYS` above the new-test window                     | Below it, both cohort families tell the same story and the contrast is gone.                        |
| `SYNTH_COHORT_SHORT_WINDOW_DAYS` below the new-test window                    | Above it, the short-lived family stops being "never not-new".                                       |
| `MONITORS_NEW_TEST_WINDOW_DAYS` above the new-test window                     | Below it, every dated test is always new and the graduated half disappears.                         |
| `SYNTH_BRANCH_RELEASE_SEMVER` matching `release/?.?.?`                        | Otherwise `release/?.?.?` and `release/*.beta` become indistinguishable.                            |
| `SYNTH_BRANCH_RELEASE_BETA` matching `release/*.beta` and not `release/?.?.?` | Same reason, from the other side.                                                                   |
| `retries` in `monitors/pass-on-retry/playwright.config.ts`                    | Below the deepest rung, the deepest test never passes and quietly becomes a second `never_passes…`. |
| The hourly cadence                                                            | Pass-on-retry pairs form only inside a trailing window of a few hours.                              |

**Renaming anything that appears in a test name changes test identity** — a variant, a branch, a cohort
window. The renamed thing starts with no history rather than inheriting the old one's. Changing a rate
never does this. See [`architecture.md`](architecture.md).

`SYNTH_REPO_URL` has no default for the same reason: the repository name is part of every test's
identity, so a default would let your fork's synthetic runs merge into the original's history. CI
passes the running repository automatically, so there is nothing to set.

## Verifying your fork works

In order, because each step takes longer than the one before it.

| After     | Check                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| First run | The `synth`, `monitors`, and `app` jobs are green, and **no upload-skipped notices** in the logs.                                |
| First run | Roughly 90 test cases arrived across three collections. Fewer means a collection ID is unset.                                    |
| ~1 hour   | A second hourly run. Two data points per test, and a pull request opened by the factory.                                         |
| ~2 hours  | The factory has closed its first pull request without merging it, and PR-attributed runs exist. If they do not, it is the token. |
| ~6 hours  | Pass-on-retry pairs, which need several distinct commits inside one window.                                                      |
| ~1 day    | Failure rates separate. `fails_on_a_low_rate` near 8%, `fails_on_a_high_rate` near 65%.                                          |
| ~2 days   | Duration monitors have enough history for the slow-test ramp to be visible.                                                      |
| ~14 days  | The new-test window elapses for the first dated cohorts and the first live dated tests.                                          |
| ~30 days  | The first long-lived cohort retires, having lived the full lifecycle.                                                            |

Nothing before the one-day mark tells you whether the rates are right, and nothing before the two-week
mark tells you whether the lifecycle stories work. That is a property of the monitors, not of the
setup.

## Related

- [`configuration.md`](configuration.md) — every variable and secret in one table
- [`operations.md`](operations.md) — the token requirement most forks hit first, and what to check when
  data stops arriving
- [`architecture.md`](architecture.md) — the invariants a fork should not break
