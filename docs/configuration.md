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

| Key              | Kind | Purpose                                                |
| ---------------- | ---- | ------------------------------------------------------ |
| `SYNTH_SCALE_*`  | var  | Report count, suite and case cardinality for `synth/`. |
| `*_RUN_RATE`     | var  | How often each folder generates or runs.               |
| `*_FAILURE_RATE` | var  | Failure percentages, per folder.                       |

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
