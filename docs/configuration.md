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
| `APP_TEST_COLLECTION`      | var  | Collection ID for `app/`.      |

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

| Key                            | Kind | Default | Effect                             |
| ------------------------------ | ---- | ------- | ---------------------------------- |
| `MONITORS_FAILURE_RATE_LOW`    | var  | 8       | Rate for `fails_on_a_low_rate`.    |
| `MONITORS_FAILURE_RATE_MEDIUM` | var  | 30      | Rate for `fails_on_a_medium_rate`. |
| `MONITORS_FAILURE_RATE_HIGH`   | var  | 65      | Rate for `fails_on_a_high_rate`.   |

A rate outside 0–100, or one that is not a number, logs a warning and falls back to its default
rather than failing the suite. A typo should show up as the demo being quieter than expected, not as
a red run that looks like a real breakage.

## The PR factory

| Key                | Kind   | Purpose                                                                                                                                      |
| ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PR_FACTORY_TOKEN` | secret | GitHub App token or PAT used to open the factory's pull requests. **Not** the default workflow token — see [`operations.md`](operations.md). |

## Safe ranges and what to watch

_Populated per story. The rule of thumb: a rate change is safe, a scale change costs runner
minutes, and a cadence change interacts with monitor evaluation windows described in
[`operations.md`](operations.md)._

## Related

- [`architecture.md`](architecture.md) — why configuration lives here and not in test code
- [`operations.md`](operations.md) — the evaluation windows that constrain safe cadence values
- [`forking.md`](forking.md) — the minimum set of values a fork must change
