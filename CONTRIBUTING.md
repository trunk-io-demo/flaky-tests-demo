# Contributing, running, and forking

Three things live here: how to run everything locally, every variable you can tune, and how to stand
up your own copy.

If you are changing code rather than running it, read [`CLAUDE.md`](CLAUDE.md) first — and
[`monitors/CLAUDE.md`](monitors/CLAUDE.md) if the change is to a monitor story.

## Running it locally

```bash
pnpm install          # one lockfile resolves every workspace member
```

| Command                                        | Runs                                        |
| ---------------------------------------------- | ------------------------------------------- |
| `pnpm test`                                    | Every vitest story.                         |
| `pnpm test:e2e`                                | Every playwright story.                     |
| `pnpm lint` / `pnpm format` / `pnpm typecheck` | The checks CI runs.                         |
| `cargo test`                                   | The `synth/` generators' own tests.         |
| `cd monitors/failure-rate && pnpm test`        | One story on its own. Works in any package. |

**Expect failures.** Most stories here fail on purpose, and every deliberate failure message ends by
saying so. A story whose tests all pass is usually a story that is not working.

Generating synthetic reports needs the repository URL, which has no default — the repository name is
part of every test's identity, so a default would let a fork's runs merge into the original's
history:

```bash
SYNTH_REPO_URL=https://github.com/your-org/your-fork cargo run -p cohorts
```

That writes JUnit XML and an upload manifest to `./synth-out`. Nothing is uploaded; uploads need an
org token, which only CI has.

### Validating against the real parser

Worth doing before claiming a report is correct. With the uploader binary present, `cargo test` runs
generated JUnit through the uploader's own `validate` subcommand, which parses it exactly as an
upload would and sends nothing anywhere:

```bash
curl -sSL -o /tmp/cli.tar.gz \
  https://github.com/trunk-io/analytics-cli/releases/latest/download/trunk-analytics-cli-x86_64-unknown-linux.tar.gz
tar xzf /tmp/cli.tar.gz -C /tmp
TRUNK_ANALYTICS_CLI=/tmp/trunk-analytics-cli cargo test
```

The same binary validates the TypeScript stories' output, and a `--dry-run` upload shows what
attribution and code-owner resolution would land:

```bash
/tmp/trunk-analytics-cli validate --junit-paths 'monitors/*/test-results/*.xml'
```

## Configuration

Everything is tuned through **GitHub repository variables and secrets**, never by editing a test.
Keeping collection IDs in variables rather than in workflow YAML is the single change that makes
forking work.

### Where a run came from

| Key                  | Kind | Purpose                                                                                                                                                 |
| -------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROTECTED_BRANCHES` | var  | Branches the org protects, comma-separated. Matched **exactly**, not by glob. Read by `monitors/utils` to decide whether a run is `PB`. Default `main`. |

Several monitor stories branch on how the product will classify a run — `PB`, `PR`, `MQ`, or `NONE`.
That is derived from CI's own environment, so nothing needs setting for it to work; `PROTECTED_BRANCHES`
only matters if your default branch is not `main`.

### Identity and destination

| Key                 | Kind   | Purpose                                                                              |
| ------------------- | ------ | ------------------------------------------------------------------------------------ |
| `TRUNK_ORG_SLUG`    | var    | Org URL slug uploads are attributed to.                                              |
| `TRUNK_API_TOKEN`   | secret | Org API token. Absent on fork pull requests; uploads skip cleanly when so.           |
| `TRUNK_API_ADDRESS` | var    | API address. Lets a fork point at a different environment with no code change.       |
| `PR_FACTORY_TOKEN`  | secret | App token or PAT for the PR factory. **Not** the default workflow token — see below. |

### Test collections

One per top-level folder, so each folder's data can be read and retained independently. An 8-character
alphanumeric ID. If one is unset, that folder's upload is skipped rather than landing in the org
default.

| Key                        | Folder      |
| -------------------------- | ----------- |
| `SYNTH_TEST_COLLECTION`    | `synth/`    |
| `MONITORS_TEST_COLLECTION` | `monitors/` |
| `APPS_TEST_COLLECTION`     | `apps/`     |

### `monitors/`

| Key                               | Default | Effect                                                                                                                              |
| --------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MONITORS_FAILURE_RATE_LOW`       | 8       | Rate for `fails on a low rate`.                                                                                                     |
| `MONITORS_FAILURE_RATE_MEDIUM`    | 30      | Rate for `fails on a medium rate`.                                                                                                  |
| `MONITORS_FAILURE_RATE_HIGH`      | 65      | Rate for `fails on a high rate`. Keep the three far enough apart that a day of runs distinguishes them.                             |
| `MONITORS_FAILURE_COUNT_RATE`     | 10      | Rate for the three "sometimes" groups in `failure-count`. The always-on groups are 100% by design.                                  |
| `MONITORS_SKIP_RATE`              | 40      | Rate the sometimes-skipped test skips at. Keep it away from 0 and 100 or it duplicates a neighbour.                                 |
| `MONITORS_NEW_TEST_WINDOW_DAYS`   | 21      | Rolling window of dated tests. Must exceed the new-test window (14 days) or the graduated half of the story disappears.             |
| `MONITORS_SLOW_BASE_MS`           | 150     | Baseline duration for the slow-test stories.                                                                                        |
| `MONITORS_SLOW_GROWTH_MS`         | 120     | Milliseconds added per day of the ramp.                                                                                             |
| `MONITORS_SLOW_CYCLE_DAYS`        | 14      | Ramp length before it resets. `GROWTH × CYCLE` is real wall clock on the peak day.                                                  |
| `MONITORS_SLOW_SPIKE_FACTOR`      | 8       | How much slower a spiked run is, as a multiple of the baseline.                                                                     |
| `MONITORS_TIMEOUT_PASS_MS`        | 150     | What a healthy pass costs in the timeout story.                                                                                     |
| `MONITORS_TIMEOUT_CEILING_MS`     | 5000    | Ceiling a failing run blocks against. Real wall clock on every failing run, and must stay well under the test's own vitest timeout. |
| `MONITORS_TIMEOUT_JITTER_PERCENT` | 3       | Jitter on the ceiling. Zero makes every failure byte-identical, which reads as generated.                                           |
| `MONITORS_TIMEOUT_FAILURE_RATE`   | 20      | How often the awaited response fails to arrive.                                                                                     |

`monitors/pass-on-retry` has nothing tunable: the attempt counts are the story, and `retries` in its
playwright config must stay at or above the deepest rung of the ladder.

### `apps/`

| Key                                | Default | Effect                                                                                                                                                            |
| ---------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPS_PARKING_PAID_HOURS`          | `8-18`  | Paid-parking window, as `START-END` hours **UTC**. A local timezone would make the pattern depend on daylight saving.                                             |
| `APPS_MASS_DETECTION_DAY_OF_MONTH` | 13      | Day of each month twenty tests fail together. Capped at 28, since 29–31 do not exist in every month. **Setting this to today fires the event on the next run.**   |
| `APPS_THIRD_PARTY_BURST`           | 6       | Requests per run that spend GitHub's shared unauthenticated budget. Capped at 20 in code. At the default this repo uses ~10% of a 60/hour budget it does not own. |
| `APPS_UPTIME_THRESHOLD`            | `major` | Minimum GitHub status severity that fails: `minor`, `major`, `critical`. `minor` fires considerably more often.                                                   |

### `synth/`

| Key                                | Default               | Effect                                                                                          |
| ---------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `SYNTH_REPO_URL`                   | none — required       | Repository URL uploads are attributed to. CI passes the running repository.                     |
| `SYNTH_PROTECTED_BRANCHES`         | `main`                | Branches the org protects, comma-separated. Matched **exactly**, not by glob.                   |
| `SYNTH_AUTHOR_NAME`                | `synth`               | Commit author on fabricated attribution.                                                        |
| `SYNTH_COHORT_LONG_WINDOW_DAYS`    | 30                    | Long-lived cohort window. Must exceed the new-test window.                                      |
| `SYNTH_COHORT_SHORT_WINDOW_DAYS`   | 10                    | Short-lived cohort window. Must be under it.                                                    |
| `SYNTH_COHORT_BIRTH_INTERVAL_DAYS` | 1                     | Days between cohort births. Raising it thins the story and the test count.                      |
| `SYNTH_COHORTS_FAILURE_RATE`       | 12                    | Rate a cohort fails at.                                                                         |
| `SYNTH_COHORTS_SKIP_RATE`          | 3                     | Rate a cohort is skipped at.                                                                    |
| `SYNTH_BRANCH_RATE_PROTECTED`      | 4                     | Failure rate on the protected branch. Keep it the lowest.                                       |
| `SYNTH_BRANCH_RATE_MERGE_QUEUE`    | 9                     | Failure rate on merge-queue runs.                                                               |
| `SYNTH_BRANCH_RATE_RELEASE_SEMVER` | 22                    | Failure rate on the numbered release branch.                                                    |
| `SYNTH_BRANCH_RATE_RELEASE_BETA`   | 38                    | Failure rate on the pre-release branch.                                                         |
| `SYNTH_BRANCH_RATE_PULL_REQUEST`   | 55                    | Failure rate on pull-request branches. Keep it the highest.                                     |
| `SYNTH_BRANCH_RELEASE_SEMVER`      | `release/1.4.2`       | Must match `release/?.?.?`, or one of the three release filters becomes untestable.             |
| `SYNTH_BRANCH_RELEASE_BETA`        | `release/2.0.0.beta`  | Must match `release/*.beta` and **not** `release/?.?.?`.                                        |
| `SYNTH_BRANCH_PULL_REQUEST`        | `feature/promo-codes` | Pull-request branch name.                                                                       |
| `SYNTH_VARIANT_RATE_LINUX`         | 3                     | Failure rate for the `linux` variant.                                                           |
| `SYNTH_VARIANT_RATE_MACOS`         | 34                    | Failure rate for the `macos` variant.                                                           |
| `SYNTH_VARIANT_RATE_WINDOWS`       | 12                    | Failure rate for the `windows` variant.                                                         |
| `SYNTH_VARIANTS`                   | `linux,macos,windows` | Variant names, in the same order as the rates. Adding one without a rate is refused at startup. |
| `SYNTH_NOW`                        | now                   | Pins the current time, RFC 3339. Only for reproducing a past run.                               |
| `SYNTH_SEED`                       | derived               | Overrides the derived seed. Only for reproducing one surprising run.                            |

### What is load-bearing rather than tunable

A reasonable-looking change to any of these silently removes a demonstration.

| Leave alone                                                                   | Because                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `SYNTH_COHORT_LONG_WINDOW_DAYS` above the new-test window                     | Below it, both cohort families tell the same story.                                         |
| `SYNTH_COHORT_SHORT_WINDOW_DAYS` below the new-test window                    | Above it, the short-lived family stops being "never not-new".                               |
| `MONITORS_NEW_TEST_WINDOW_DAYS` above the new-test window                     | Below it, every dated test is always new.                                                   |
| `SYNTH_BRANCH_RELEASE_SEMVER` matching `release/?.?.?`                        | Otherwise `release/?.?.?` and `release/*.beta` become indistinguishable.                    |
| `SYNTH_BRANCH_RELEASE_BETA` matching `release/*.beta` and not `release/?.?.?` | Same reason, from the other side.                                                           |
| `retries` in `monitors/pass-on-retry/playwright.config.ts`                    | Below the deepest rung, the deepest test never passes and becomes a second `never passes…`. |
| The hourly cadence                                                            | Pass-on-retry pairs form only inside a trailing window of a few hours.                      |

Two cost real time on every run: `MONITORS_TIMEOUT_CEILING_MS` on each failing run, and
`MONITORS_SLOW_GROWTH_MS × MONITORS_SLOW_CYCLE_DAYS` on the peak day of each cycle.

Changing a **name** that appears in a test name changes test identity, so the renamed thing starts
with no history. Changing a **rate** never does.

## Forking

A demo runner should get their own copy of every story by changing variables, never by editing test
code or workflow YAML. If you find yourself editing a `.yaml` file to make a fork work, that is a bug
in this repo.

### What you need first

Provisioned by a human. This repo creates none of it and invents none of it.

- A Trunk org, with its URL slug and an API token.
- A GitHub org with the Trunk GitHub App installed.
- One test collection per top-level folder.
- A GitHub App token or PAT for the PR factory.

### The five that must be set

Nothing works until these exist, and every one of them fails **quietly**.

| Set                        | If you forget                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `TRUNK_ORG_SLUG`           | Uploads are rejected. This one at least fails visibly.                                 |
| `TRUNK_API_TOKEN`          | Every upload skips with a log line and the job stays green. Data simply never appears. |
| `SYNTH_TEST_COLLECTION`    | `synth/` uploads skip. Same silence.                                                   |
| `MONITORS_TEST_COLLECTION` | `monitors/` uploads skip.                                                              |
| `APPS_TEST_COLLECTION`     | `apps/` uploads skip.                                                                  |

A skipped upload is deliberately not a failure — a contributor's fork PR must not go red because our
demo could not upload. The cost is that a misconfigured fork looks healthy, so **check the first
run's logs for skip notices** rather than trusting the green tick.

### The one that catches everybody

`PR_FACTORY_TOKEN` must be a GitHub App token or a PAT. **Events created with the default
`GITHUB_TOKEN` do not trigger further workflow runs**, so a pull request opened with it never fires
`pr.yaml` and no pull-request-attributed data ever appears.

The symptom is confusing: the factory job goes green, pull requests appear and get closed on
schedule, and nothing PR-attributed shows up.

It matters more than it looks. Scheduled runs all report against the same head commit, because the
default branch does not move hourly — so the factory is the **only** source of distinct commits, and
`monitors/pass-on-retry` needs distinct commits to form pairs at all.

### Verifying a fork works

In order, because each step takes longer than the one before.

| After     | Check                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------- |
| First run | The `synth`, `monitors`, and `apps` jobs are green, and **no upload-skipped notices** in the logs.      |
| First run | Roughly 90 test cases across three collections. Fewer means a collection ID is unset.                   |
| ~1 hour   | A second hourly run, and a pull request opened by the factory.                                          |
| ~2 hours  | The factory closed its first PR without merging, and PR-attributed runs exist. If not, it is the token. |
| ~6 hours  | Pass-on-retry pairs, which need several distinct commits inside one trailing window.                    |
| ~1 day    | Failure rates separate. Counts and schedules become readable.                                           |
| ~2 days   | Duration monitors have enough history for the slow-test ramp.                                           |
| ~14 days  | The new-test window elapses for the first dated cohorts and dated live tests.                           |
| ~30 days  | The first long-lived cohort retires, having lived the full arc.                                         |

Nothing before the one-day mark tells you whether the rates are right, and nothing before the
two-week mark tells you whether the lifecycle stories work. That is a property of the monitors, not
of the setup.
