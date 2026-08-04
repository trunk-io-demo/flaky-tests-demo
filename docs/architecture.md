# Architecture

## What this repo is shaped around

The question this repo answers is "what does each monitor catch, and why would I want it?" That
makes the unit of the repo a **story**, not a framework and not a language. Every directory is
one story or a set of them, and the layout exists to make a story cheap to add and easy to read.

## Layout

```
flaky-tests-demo/
├── .github/
│   ├── workflows/
│   │   ├── hourly.yaml         # the schedule; owns runs-on + the variant matrix
│   │   └── pr.yaml             # on pull_request — monitors + app only
│   ├── actions/                # one composite action per top-level folder
│   │   ├── synth/
│   │   ├── monitors/
│   │   ├── app/
│   │   └── integrations/
│   └── dependabot.yml
├── docs/
├── package.json                # root: shared devDeps + aggregate scripts only
├── pnpm-workspace.yaml         # monitors/*, app/*, integrations/*
├── pnpm-lock.yaml              # ONE lockfile for every member
├── tsconfig.base.json          # each package extends this
├── vitest.config.ts            # aggregate; projects: monitors/*, app/*
├── playwright.config.ts        # aggregate
├── Cargo.toml                  # workspace; members = ["synth/*"]
├── Cargo.lock                  # ONE lockfile for every member
├── synth/                      # synthetic JUnit; nothing executes. Rust.
├── monitors/                   # one package per monitor type. TypeScript.
├── app/                        # one package per scenario. TypeScript.
└── integrations/               # deferred
```

## Invariants

These are the rules that keep the layout from rotting. Each one has a failure mode attached
because each one has already been the failure mode somewhere.

### No language level

There is no `typescript/` or `rust/` directory. `monitors/` and `app/` are TypeScript, full stop;
`synth/` is Rust because it drives a JUnit generation crate. Language is implied by purpose.

This is a commitment, not a default — it is what lets the level disappear. If a monitor story
ever needs a second language, it does not get a `monitors/<name>/python/` subdirectory; it gets a
new top-level directory with its own purpose, or it does not get written.

### File suffix selects the runner

`*.test.ts` is vitest. `*.spec.ts` is playwright.

With no language directory separating them, both runners' default globs claim both file sets, and
vitest fails loudly on the mismatched `test` import from a playwright spec. So **both configs
declare explicit include/exclude** — vitest includes `**/*.test.ts` and excludes `**/*.spec.ts`,
playwright matches only `**/*.spec.ts`. This is not defensive; it is required for the layout to
work at all.

### Manifests are per package; lockfiles are not

One `package.json` per monitor and per app scenario, one `Cargo.toml` per `synth/` subdirectory —
and exactly one `pnpm-lock.yaml` and one `Cargo.lock`, both at the root. A single root
`pnpm install` resolves every member.

Per-package manifests are what let a story own its dependencies without every other story paying
for them. The cost is dependency-bump fan-out, which is why
[`dependabot.yml`](../.github/dependabot.yml) groups every ecosystem down to one PR — configured
on day one rather than after the first eleven-PR morning.

### The workspace globs are load-bearing

A directory not matched by the globs in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml), or not
matched by `members = ["synth/*"]` in the root [`Cargo.toml`](../Cargo.toml), is invisible: no
install, no `pnpm --recursive`, no CI. This is the recurring failure mode of this repo shape, and
it fails quietly — the story simply never runs and the monitor simply never fires.

Check the globs whenever you add a directory.

Two specific traps:

- **Cargo errors on a nested package that is neither a member nor excluded.** If
  `integrations/` ever gains a Rust suite, it must be added to `members` or to `exclude` in the
  root `Cargo.toml` in the same commit.
- `integrations/*` is already in the pnpm globs even though it currently holds no packages, so
  landing that work later needs no restructuring.

### Adding a story requires no CI edit

The per-folder composite actions iterate workspace members with `pnpm --filter` rather than
naming paths. A new `monitors/<name>/` with a `test` script is picked up by the next scheduled
run. If you find yourself editing a workflow to add a story, something has drifted.

## Why `synth/` is Rust, and why it does not shell out

`synth/` fabricates JUnit XML that would otherwise take weeks of real runs to accumulate — a
30-day test lifecycle, a per-branch failure rate, a macOS-only failure emitted from a Linux
runner. It is Rust because JUnit generation is a Rust concern in the analytics toolchain, and it
builds reports **in process** through the `quick-junit` library rather than shelling out to a
generator binary, so every option is set programmatically from configuration instead of being
assembled into a command line.

### Test identity is the constraint that shaped this

A test's identity in the product is derived from the tuple of repository, **file**, **classname**,
suite path, **name**, and variant. Every one of those must be byte-identical across runs or the
product sees a brand-new test rather than another run of an existing one — which would break
every story in `synth/`, since all of them depend on one test accumulating history.

That rules out generic mock-report generation, which randomizes the `file` attribute and pairs
names with classnames by independent shuffle. `synth/junit-gen` therefore owns identity
explicitly: name, classname, file, and suite are all derived from the story ID, and only the
things that are _not_ part of identity — durations, outcomes, message text — are drawn from the
seeded RNG.

### Determinism

Seeds are derived, never random: `seed = hash(storyId, dateBucket)`. The data looks random,
reproduces exactly, and produces the same story in a fork as in the original. That is what makes
this repo a regression fixture and not only a demo. There is no unseeded randomness anywhere in
`synth/`.

Retirement dates are derivable from a cohort's name rather than tracked in separate state. If
they were tracked separately, an unplanned gap in the schedule would be indistinguishable from an
intentional retirement.

## Uploads

Test results reach the product through `trunk-io/analytics-uploader`, which is the action a
customer would use, invoked the way a customer would invoke it. `monitors/` and `app/` use it
directly.

`synth/` is the exception: it performs many uploads per run, each with different fabricated
attribution — a different branch, SHA, PR number, or variant per upload — and a composite action
cannot loop a `uses:` step. So the `synth/` action resolves the uploader CLI once and loops over
the generator's manifest, passing each upload's attribution through the CLI's environment
variables. Same binary, same code path, driven directly.

Attribution for `synth/` needs no git history, no branch, and no pull request: the uploader
supports an uncloned-repo mode where repository URL, head SHA, head branch, and author name are
all supplied explicitly, alongside PR number and commit epoch.

**Branch class is derived, not set.** The uploader infers it, and configuration therefore
expresses a _desired class_ while the generator produces naming that yields it:

| Target  | How to produce it                            | Caveat                                          |
| ------- | -------------------------------------------- | ----------------------------------------------- |
| `MERGE` | branch contains a merge-queue prefix         | Wins over everything, including a set PR number |
| `PR`    | set the PR-number override to any integer    | No real pull request required                   |
| `PB`    | branch matches a configured protected branch | Warns if a PR number is also set                |
| `NONE`  | anything else                                | The fallthrough                                 |

Illegal combinations produce validation warnings, so configuration encodes only the legal pairs
rather than letting a fork invent one.

## Further reading

- [`configuration.md`](configuration.md) — every variable and secret
- [`monitors.md`](monitors.md) — the monitor catalog and which story demonstrates each
- [`operations.md`](operations.md) — cadence, the PR factory, and what to check when data stops
- [`forking.md`](forking.md) — making your own copy
