# Contributing

Changing code rather than running it? Read [`CLAUDE.md`](CLAUDE.md), and
[`monitors/CLAUDE.md`](monitors/CLAUDE.md) for the monitor stories.

## Running locally

```bash
pnpm install
```

| Command                                 | Runs                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| `pnpm test`                             | Every vitest story in `monitors/` and `apps/`.         |
| `pnpm test:e2e`                         | Every playwright story.                                |
| `pnpm typecheck`                        | TypeScript across every package.                       |
| `trunk check --all` / `trunk fmt`       | Every linter and formatter.                            |
| `cargo run -p generate`                 | The `synth/` generator. Writes JUnit, uploads nothing. |
| `cargo test`                            | The generator's own tests — a gate, never uploaded.    |
| `cd monitors/failure-rate && pnpm test` | One story. Works in any package.                       |

**Expect failures.** Most stories fail on purpose and say so in the failure message.

Trunk drives lint and format, with both git hooks enabled — you should not need to run either by
hand. Rust is checked by cargo; `.trunk/trunk.yaml` says why.

A local run classifies as a `PR` run. `PB` is one variable away:

```bash
GITHUB_REF_NAME=main pnpm test              # PB
```

`MQ` has no local equivalent and needs none: the merge queue's testing branches produce those runs for
real, every hour.

### Generating synthetic reports

`synth/` runs no tests: one binary fabricates JUnit and the workflow uploads it.

```bash
cargo run -p generate                     # into synth-out/, then print what it decided
cargo run -p generate -- --out-dir /tmp/s
cargo run -p generate -- --quiet
```

The variables below change what it produces, and they are the same ones CI reads:

```bash
SYNTH_FAILURE_RATE=100 cargo run -p generate    # an all-failing upload
SYNTH_DURABLE_TEST_COUNT=500 \
  SYNTH_CHURN_TEST_COUNT=2000 \
  SYNTH_RUNS_PER_TEST=10 cargo run -p generate  # 25,000 cases across many reports
```

Two runs in the same hour are byte-identical, which `--now` pins:

```bash
now="$(date -u +%Y-%m-%dT%H:00:00Z)"
cargo run -p generate -- --now "$now" --out-dir /tmp/a --quiet
cargo run -p generate -- --now "$now" --out-dir /tmp/b --quiet
diff -r /tmp/a /tmp/b && echo identical
```

Pin an old timestamp and the reports will be too stale to ingest, so keep `--now` near the present.

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
/tmp/trunk-analytics-cli validate $(printf -- '--junit-paths %s ' synth-out/*.xml)
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

Most of these fail **quietly**: a missing collection ID leaves a notice saying the upload will not land
rather than failing the job. Check the first run's logs for those notices rather than trusting a green tick.

`PR_FACTORY_TOKEN` is the exception — the factory **fails loudly** if it is unset. That workflow only runs
on a schedule or by hand, never on a fork's pull request, so a missing token is this repository being
misconfigured rather than a contributor hitting a wall, and the PR-attributed half of the demo would
otherwise produce nothing forever without saying so.

### `synth/`

Five repository variables, all optional and all bounded — see
[`synth/config`](synth/config/README.md) for the ranges and what each one measures:

| Variable                   | Default |
| -------------------------- | ------- |
| `SYNTH_FAILURE_RATE`       | 12      |
| `SYNTH_FLAKE_RATE`         | 5       |
| `SYNTH_RUNS_PER_TEST`      | 1       |
| `SYNTH_DURABLE_TEST_COUNT` | 48      |
| `SYNTH_CHURN_TEST_COUNT`   | 10      |

Out of range they clamp and annotate rather than failing the run. There is nothing to set for the
repository, branch, or actor: `synth/` writes JUnit and nothing else, and the uploader reads those from
the checkout the same way it does for `monitors/`.

## The PR factory token

The factory is its own workflow, [`pr-factory.yaml`](.github/workflows/pr-factory.yaml), on its own clock:
it runs at :15 and the stories at :45, so the head has already moved by the time the hourly uploads report
against it. Two jobs — merge last hour's, then open this hour's — so the new pull request is based on the
merged head. Opening uses
[`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request); merging is `gh`,
which the action does not do.

`PR_FACTORY_TOKEN` must be a GitHub App token or a PAT.

### What the token needs

Derived from what the two workflows using it actually do: push a branch, open a pull request with a label,
list open pull requests, comment on one, and squash-merge or close one while deleting its branch.

| Token type            | Grant                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **GitHub App** (best) | Repository permissions: **Contents: read & write**, **Pull requests: read & write**. Installed on this repository. |
| Fine-grained PAT      | Same two, plus **Metadata: read** (mandatory and implicit). Note these expire.                                     |
| Classic PAT           | `repo`, or `public_repo` if this repository is public and always will be.                                          |

Nothing needs **Workflows: write** — the heartbeat is written to `.github/pr-factory/`, not to
`.github/workflows/`, and a push that touches a workflow file is the only thing that requires it.

Three repository settings matter as much as the token:

1. **Settings → Actions → General → Workflow permissions**: "Allow GitHub Actions to create and approve
   pull requests" must be on, or `create-pull-request` fails regardless of the token.
2. **Squash merging must be enabled**, because the merge step uses `--squash`.
3. **Branch protection on the default branch will block the merge** unless the App or user can bypass it.
   The factory closes what it cannot merge and warns, so the symptom is an hourly warning and a head that
   never moves — not a red job. **Events created with the default
   `GITHUB_TOKEN` do not trigger further workflow runs**, so a pull request opened with it never fires
   `pr.yaml` and no PR-attributed data appears. The symptom is confusing: the factory goes green, pull
   requests appear and get merged on schedule, and nothing shows up.

It does two jobs. It is the only source of pull-request-attributed runs, and because it **merges** last
hour's pull request rather than closing it, it is also what advances the default branch. Without that the
head never moves and every scheduled run reports the same commit, so pass-on-retry pairs pile onto one
commit with hundreds of runs instead of many commits each holding a pair.

The token therefore needs write access to the default branch. If a merge cannot go through, the factory
closes that pull request and warns, rather than retrying a stuck one every hour.

## Enqueueing for merge

Every open, non-draft pull request carrying the `pr-factory` label gets a `/trunk merge` comment every ten
minutes, from [`mq-enqueue.yaml`](.github/workflows/mq-enqueue.yaml). It reuses `PR_FACTORY_TOKEN` and needs
no grant beyond the two the factory already required — a comment is **Pull requests: write**.

**The cadence is the retry, not a schedule.** Enqueueing fails routinely here and is meant to: a pull
request whose failures are not quarantined yet cannot enter the queue, and one whose required checks fail is
evicted from it. Nothing else resubmits them, so commenting once when a pull request opens would leave every
one of those sitting until the factory force-merged it.

**The comment comes from a real account, not `github-actions[bot]`.** A queue takes commands from a linked
user with access to the repository; a bot has to be named in the queue's allowed bot submitters first.
`PR_FACTORY_TOKEN` already belongs to such an account, which is the whole reason it posts the comment.

**Dependabot and the queue's own pull requests are excluded by construction, not by name.** Only the
factory's pull requests carry the label, and the queue's testing pull requests are drafts — which is also
what they are for: a draft pull request per testing branch is what fires `pr.yaml`, and that run is where
`MQ`-class results come from. Nothing in `pr.yaml` knows the queue exists.

**The queue does not replace the factory's merge.** `pr-factory.yaml` still force-merges last hour's pull
request before opening this hour's, so the head advances on the hour whatever the queue did. The queue
landing a pull request first is the good case; the force-merge is the floor under it.

### Which checks the queue requires

The queue's required checks live in its settings in the Trunk app, not in this repository — so they can be,
and are meant to be, stricter than the ruleset that governs a direct merge.

Know what that costs before adding one. **The four upload jobs are red on essentially every run**, because
the uploader owns each job's exit code and returns non-zero while any failure is unquarantined — which for
this repository is the steady state, not an incident. `monitors` is red by construction on a testing branch:
[`failure-count`](monitors/failure-count/) holds `always fails MQ`, an always-fails test rather than a flaky
one, so it is never a quarantine candidate. Requiring any of the four therefore evicts every pull request,
every time, and the factory's force-merge becomes the only thing that lands one. That is an available
choice — evictions and resubmissions are worth demonstrating — but it is a choice, and the retry cadence
multiplies its cost: each eviction is re-enqueued ten minutes later, and each resubmission is another full
testing branch through `pr.yaml`, macOS leg included.

## Verifying a fork

| After     | Check                                                                                   |
| --------- | --------------------------------------------------------------------------------------- |
| First run | Jobs green, **no "upload will not land" notices**, results in all three collections.    |
| ~1 hour   | A `trunk-merge/…` draft pull request has existed and uploaded `MQ`-class results.       |
| ~2 hours  | PR-attributed runs exist, and the default branch has a merge commit. If not, the token. |
| ~2 hours  | Pass-on-retry pairs from the retry ladder, which pair inside a single upload.           |
| ~1 day    | Failure rates separate; counts and schedules become readable.                           |
| ~14 days  | The new-test window elapses for the first churn tests.                                  |
| ~30 days  | Churn tests have come and gone, resolving by absence.                                   |

Nothing before the one-day mark tells you whether the rates are right. That is a property of the
monitors, not of the setup.
