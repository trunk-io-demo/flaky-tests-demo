# Contributing

Changing code rather than running it? Read [`CLAUDE.md`](CLAUDE.md), and
[`monitors/CLAUDE.md`](monitors/CLAUDE.md) for the monitor stories.

## Running locally

```bash
pnpm install
```

| Command                                 | Runs                                |
| --------------------------------------- | ----------------------------------- |
| `pnpm test`                             | Every vitest story.                 |
| `pnpm test:e2e`                         | Every playwright story.             |
| `pnpm typecheck`                        | TypeScript across every package.    |
| `trunk check --all` / `trunk fmt`       | Every linter and formatter.         |
| `cargo test`                            | The `synth/` generators' own tests. |
| `cd monitors/failure-rate && pnpm test` | One story. Works in any package.    |

**Expect failures.** Most stories fail on purpose and say so in the failure message.

Trunk drives lint and format, with both git hooks enabled — you should not need to run either by
hand. Rust is checked by cargo; `.trunk/trunk.yaml` says why.

A local run classifies as a `PR` run. To exercise the others:

```bash
GITHUB_REF_NAME=main pnpm test              # PB
GITHUB_REF_NAME=trunk-merge/x pnpm test     # MQ
```

### Validating against the real parser

```bash
curl -sSL -o /tmp/cli.tar.gz \
  https://github.com/trunk-io/analytics-cli/releases/latest/download/trunk-analytics-cli-x86_64-unknown-linux.tar.gz
tar xzf /tmp/cli.tar.gz -C /tmp
TRUNK_ANALYTICS_CLI=/tmp/trunk-analytics-cli cargo test
```

With that set, `cargo test` runs generated JUnit through the uploader's own `validate` subcommand,
which parses it exactly as an upload would and sends nothing. The same binary validates the
TypeScript stories' output:

```bash
/tmp/trunk-analytics-cli validate --junit-paths 'monitors/*/test-results/*.xml'
```

## Configuration

`monitors/` and `apps/` read no repository variables. Their rates, windows, and thresholds are
constants in the test files, so a story is readable without cross-referencing settings. Configuration
is a `synth/` concern.

### Required for uploads

| Key                        | Kind   | Notes                                                              |
| -------------------------- | ------ | ------------------------------------------------------------------ |
| `TRUNK_ORG_SLUG`           | var    |                                                                    |
| `TRUNK_API_TOKEN`          | secret | Absent on fork pull requests; uploads skip cleanly.                |
| `TRUNK_API_ADDRESS`        | var    | Points a fork at a different environment.                          |
| `SYNTH_TEST_COLLECTION`    | var    | One collection per folder. Unset means that folder's upload skips. |
| `MONITORS_TEST_COLLECTION` | var    |                                                                    |
| `APPS_TEST_COLLECTION`     | var    |                                                                    |
| `PR_FACTORY_TOKEN`         | secret | **Not** the default workflow token — see below.                    |

Every one of these fails **quietly**: a missing token or collection ID skips the upload with a log
notice and leaves the job green, so a contributor's fork PR does not go red. Check the first run's
logs for skip notices rather than trusting the green tick.

### `synth/`

`SYNTH_REPO_URL` is required and has no default: the repository name is part of test identity, so a
default would let a fork's runs merge into the original's history. CI passes it automatically.

The rest tune rates, windows, and scale — see each generator's README for its own table:
[`cohorts`](synth/cohorts/), [`branch-rates`](synth/branch-rates/),
[`variant-rates`](synth/variant-rates/).

Four are load-bearing rather than tunable, because a reasonable change silently removes a story:
`SYNTH_COHORT_LONG_WINDOW_DAYS` must exceed the new-test window and
`SYNTH_COHORT_SHORT_WINDOW_DAYS` must be under it, and the two `SYNTH_BRANCH_RELEASE_*` branches must
keep matching the globs they were chosen to distinguish.

## The PR factory token

`PR_FACTORY_TOKEN` must be a GitHub App token or a PAT. **Events created with the default
`GITHUB_TOKEN` do not trigger further workflow runs**, so a pull request opened with it never fires
`pr.yaml` and no PR-attributed data appears. The symptom is confusing: the factory goes green, PRs
appear and get closed on schedule, and nothing shows up.

It matters more than it looks. Scheduled runs all report against the same head commit, so the factory
is the only source of pull-request commits, so PR-attributed data comes from nowhere else.

## Verifying a fork

| After     | Check                                                                               |
| --------- | ----------------------------------------------------------------------------------- |
| First run | Jobs green, **no upload-skipped notices**, ~90 test cases across three collections. |
| ~2 hours  | PR-attributed runs exist. If not, it is the token.                                  |
| ~2 hours  | Pass-on-retry pairs from the retry ladder, which pair inside a single upload.       |
| ~1 day    | Failure rates separate; counts and schedules become readable.                       |
| ~14 days  | The new-test window elapses for the first dated cohorts.                            |
| ~30 days  | The first long-lived cohort retires, having lived the full arc.                     |

Nothing before the one-day mark tells you whether the rates are right. That is a property of the
monitors, not of the setup.
