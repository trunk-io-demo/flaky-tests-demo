# Configuration

Every behavior of this repo is tuned through **GitHub repository variables and secrets**, never by
editing a test. Run rate, failure rate, and scale are configuration; so are the org slug, the API
address, and every test collection ID.

Keeping collection IDs in variables rather than in workflow YAML is the single change that makes
forking work. A fork that inherits hardcoded IDs uploads into the original's collections until
someone edits YAML — see [`forking.md`](forking.md).

## Identity and destination

| Key                 | Kind   | Purpose                                                                        |
| ------------------- | ------ | ------------------------------------------------------------------------------ |
| `TRUNK_ORG_SLUG`    | var    | Org URL slug that uploads are attributed to.                                   |
| `TRUNK_API_TOKEN`   | secret | Org API token. Absent on fork pull requests; uploads skip cleanly when so.     |
| `TRUNK_API_ADDRESS` | var    | API address. Lets a fork point at a different environment with no code change. |

## Test collections

One collection per top-level folder, so that a folder's stories can be read — and its data
retained or discarded — independently.

| Key                        | Kind | Purpose                        |
| -------------------------- | ---- | ------------------------------ |
| `SYNTH_TEST_COLLECTION`    | var  | Collection ID for `synth/`.    |
| `MONITORS_TEST_COLLECTION` | var  | Collection ID for `monitors/`. |
| `APPS_TEST_COLLECTION`     | var  | Collection ID for `apps/`.     |

A collection ID is an 8-character alphanumeric string. If one is unset, that folder's upload is
skipped with a log line rather than uploaded to the org default.

## Scale and rates

_Populated as the generators and stories land. Each entry below documents what changing the value
does and the range that stays safe._

### `synth/`

| Key                                | Kind | Default               | Effect                                                                                                                                                                                                                           |
| ---------------------------------- | ---- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SYNTH_REPO_URL`                   | var  | none — required       | Repository URL uploads are attributed to. No default on purpose: the repository name is part of every test's identity, so a default would let a fork's runs merge into the original's history. CI passes the running repository. |
| `SYNTH_PROTECTED_BRANCHES`         | var  | `main`                | Branches the org protects, comma-separated. Matched **exactly**, not by glob. A branch not in this list arrives as `NONE`, not `PB`.                                                                                             |
| `SYNTH_AUTHOR_NAME`                | var  | `synth`               | Commit author on fabricated attribution.                                                                                                                                                                                         |
| `SYNTH_COHORT_LONG_WINDOW_DAYS`    | var  | 30                    | Long-lived cohort emission window. Must exceed the new-test window.                                                                                                                                                              |
| `SYNTH_COHORT_SHORT_WINDOW_DAYS`   | var  | 10                    | Short-lived cohort window. Must be under the new-test window.                                                                                                                                                                    |
| `SYNTH_COHORT_BIRTH_INTERVAL_DAYS` | var  | 1                     | Days between cohort births. Raising it thins the story and the test count.                                                                                                                                                       |
| `SYNTH_COHORTS_FAILURE_RATE`       | var  | 12                    | Percentage of runs a cohort fails in.                                                                                                                                                                                            |
| `SYNTH_COHORTS_SKIP_RATE`          | var  | 3                     | Percentage of runs a cohort is skipped in.                                                                                                                                                                                       |
| `SYNTH_BRANCH_RATE_PROTECTED`      | var  | 4                     | Failure rate on the protected branch. Keep it the lowest.                                                                                                                                                                        |
| `SYNTH_BRANCH_RATE_MERGE_QUEUE`    | var  | 9                     | Failure rate on merge-queue runs.                                                                                                                                                                                                |
| `SYNTH_BRANCH_RATE_RELEASE_SEMVER` | var  | 22                    | Failure rate on the numbered release branch.                                                                                                                                                                                     |
| `SYNTH_BRANCH_RATE_RELEASE_BETA`   | var  | 38                    | Failure rate on the pre-release branch.                                                                                                                                                                                          |
| `SYNTH_BRANCH_RATE_PULL_REQUEST`   | var  | 55                    | Failure rate on pull-request branches. Keep it the highest.                                                                                                                                                                      |
| `SYNTH_BRANCH_RELEASE_SEMVER`      | var  | `release/1.4.2`       | Must match `release/?.?.?`, or one of the three release filters becomes untestable.                                                                                                                                              |
| `SYNTH_BRANCH_RELEASE_BETA`        | var  | `release/2.0.0.beta`  | Must match `release/*.beta` and **not** `release/?.?.?`.                                                                                                                                                                         |
| `SYNTH_BRANCH_PULL_REQUEST`        | var  | `feature/promo-codes` | Pull-request branch name.                                                                                                                                                                                                        |
| `SYNTH_VARIANT_RATE_LINUX`         | var  | 3                     | Failure rate for the `linux` variant.                                                                                                                                                                                            |
| `SYNTH_VARIANT_RATE_MACOS`         | var  | 34                    | Failure rate for the `macos` variant.                                                                                                                                                                                            |
| `SYNTH_VARIANT_RATE_WINDOWS`       | var  | 12                    | Failure rate for the `windows` variant.                                                                                                                                                                                          |
| `SYNTH_VARIANTS`                   | var  | `linux,macos,windows` | Variant names, in the same order as the rates. Adding one without a rate is refused at startup.                                                                                                                                  |
| `SYNTH_NOW`                        | var  | now                   | Pins the current time, as RFC 3339. Only for reproducing a specific past run.                                                                                                                                                    |
| `SYNTH_SEED`                       | var  | derived               | Overrides the derived seed. Only for reproducing one surprising run.                                                                                                                                                             |

### `monitors/`

| Key                               | Kind | Default | Effect                                                                                                                              |
| --------------------------------- | ---- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MONITORS_FAILURE_RATE_LOW`       | var  | 8       | Rate for `fails_on_a_low_rate`.                                                                                                     |
| `MONITORS_FAILURE_RATE_MEDIUM`    | var  | 30      | Rate for `fails_on_a_medium_rate`.                                                                                                  |
| `MONITORS_FAILURE_RATE_HIGH`      | var  | 65      | Rate for `fails_on_a_high_rate`. Keep the three far enough apart that a day of runs distinguishes them.                             |
| `MONITORS_FAILURE_COUNT`          | var  | 4       | How many of the twelve burst members fail. The suite size is fixed in code.                                                         |
| `MONITORS_SKIP_RATE`              | var  | 40      | Percentage of runs the sometimes-skipped test skips. Keep it away from 0 and 100 or it duplicates a neighbour.                      |
| `MONITORS_NEW_TEST_WINDOW_DAYS`   | var  | 21      | Rolling window of dated tests. Must exceed the new-test window (14 days) or the graduated half of the story disappears.             |
| `MONITORS_SLOW_BASE_MS`           | var  | 150     | Baseline duration for the slow-test stories.                                                                                        |
| `MONITORS_SLOW_GROWTH_MS`         | var  | 120     | Milliseconds added per day of the ramp.                                                                                             |
| `MONITORS_SLOW_CYCLE_DAYS`        | var  | 14      | Ramp length before it resets. `GROWTH × CYCLE` is real wall clock on the peak day.                                                  |
| `MONITORS_SLOW_SPIKE_FACTOR`      | var  | 8       | How much slower a spiked run is, as a multiple of the baseline.                                                                     |
| `MONITORS_TIMEOUT_PASS_MS`        | var  | 150     | What a healthy pass costs in the timeout story.                                                                                     |
| `MONITORS_TIMEOUT_CEILING_MS`     | var  | 5000    | The ceiling a failing run blocks against. Real wall clock on every failing run. Must stay well under the test's own vitest timeout. |
| `MONITORS_TIMEOUT_JITTER_PERCENT` | var  | 3       | Jitter on the ceiling. Zero makes every failure byte-identical, which reads as generated.                                           |
| `MONITORS_TIMEOUT_FAILURE_RATE`   | var  | 20      | How often the awaited response fails to arrive.                                                                                     |

`monitors/pass-on-retry` has nothing tunable. The attempt counts are the story, and `retries` in its
playwright config must stay at or above the deepest rung of the ladder or the deepest test stops
passing at all.

A rate outside 0–100, or one that is not a number, logs a warning and falls back to its default
rather than failing the suite. A typo should show up as the demo being quieter than expected, not as
a red run that looks like a real breakage.

### `apps/`

| Key                                | Kind | Default | Effect                                                                                                                                                                 |
| ---------------------------------- | ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPS_PARKING_PAID_HOURS`          | var  | `8-18`  | The paid-parking window, as `START-END` hours **UTC**. A local timezone would make the pattern depend on the runner and on daylight saving.                            |
| `APPS_MASS_DETECTION_DAY_OF_MONTH` | var  | 13      | Day of each month twenty tests fail together. Capped at 28, because 29–31 do not exist in every month. **Setting this to today fires the event on the next run.**      |
| `APPS_THIRD_PARTY_BURST`           | var  | 6       | Requests per run that spend GitHub's shared unauthenticated budget. Capped at 20 in code. At the default this repo uses about 10% of a 60/hour budget it does not own. |
| `APPS_UPTIME_THRESHOLD`            | var  | `major` | Minimum GitHub status severity that fails: `minor`, `major`, `critical`. `minor` fires considerably more often.                                                        |

## The PR factory

| Key                | Kind   | Purpose                                                                                                                                      |
| ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PR_FACTORY_TOKEN` | secret | GitHub App token or PAT used to open the factory's pull requests. **Not** the default workflow token — see [`operations.md`](operations.md). |

## Safe ranges and what to watch

The rule of thumb: **a rate change is safe, a duration change costs runner minutes, and a cadence
change interacts with the evaluation windows in [`operations.md`](operations.md).**

Four values are load-bearing rather than tunable, in the sense that a "reasonable" change to them
silently removes a story:

| Value                            | The constraint                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SYNTH_COHORT_LONG_WINDOW_DAYS`  | Must exceed the new-test window, or it stops being the contrast to the short-lived family.                               |
| `SYNTH_COHORT_SHORT_WINDOW_DAYS` | Must be under it, or it stops being a test that is never not-new.                                                        |
| `MONITORS_NEW_TEST_WINDOW_DAYS`  | Must exceed the new-test window, or every test there is always new.                                                      |
| `SYNTH_BRANCH_RELEASE_*`         | Must keep matching the glob each was chosen to distinguish. See [`synth/branch-rates`](../synth/branch-rates/README.md). |

Two cost real time on every run: `MONITORS_TIMEOUT_CEILING_MS` (paid on each failing run) and
`MONITORS_SLOW_GROWTH_MS × MONITORS_SLOW_CYCLE_DAYS` (paid on the peak day of every cycle).

Changing a **name** — a variant, a branch, a cohort window that appears in a test name — changes test
identity, so the renamed thing starts with no history rather than inheriting the old one's. Changing a
**rate** never does.

## Related

- [`architecture.md`](architecture.md) — why configuration lives here and not in test code
- [`operations.md`](operations.md) — the evaluation windows that constrain safe cadence values
- [`forking.md`](forking.md) — the minimum set of values a fork must change
