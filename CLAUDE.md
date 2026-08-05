# Conventions for iterating on this repo

Scoped conventions live next to the code — [`monitors/CLAUDE.md`](monitors/CLAUDE.md) covers the
monitor stories. This file is the repo-wide set.

**The unit of work is a story:** a test, or a stream of synthetic results, whose job is to trip at least
one monitor in a way a reader recognizes without reading the implementation. The purpose of these tests is not to pass, but to exhibit a particular failure pattern.

## Code comments: at most ten lines per file

Under ten comment lines in any source file, and prefer the top of the file. Comments earn their place
by explaining something the code cannot: why a value is what it is, what breaks if you change it, which
non-obvious behavior of a tool is being worked around.

Everything else belongs in the directory's `README.md`. A file that needs thirty lines of preamble is
telling you the explanation is documentation.

## No two tests with the same failure pattern

Two tests that fail on identical conditions are two rows of identical data: they cannot be told apart in
the product, and the second demonstrates nothing the first did not.

Where a story needs several tests — a burst, a cohort, a cascade — give each member a slightly different
pattern. A rate ladder (10%, 20%, 30%), a different age, a different duration. The story survives, and
each test earns its own row.

## Documentation

| File        | Enumerates                                 | Audience                          |
| ----------- | ------------------------------------------ | --------------------------------- |
| `README.md` | **what** a thing is, and **why** it exists | Anyone who lands on the directory |
| `CLAUDE.md` | **how** to develop in it                   | Whoever is changing the code      |

READMEs render at every directory level on GitHub, which is what we want for the what-and-why.
Conventions and gotchas go in a `CLAUDE.md` — a visitor reading a story should not have to skip past
them. Keep both short. Cross-link both directions, and land docs with the code.

## Test identity, and what breaks it

Identity is the tuple of **repository, `file`, `classname`, suite path, `name`, and `variant`**, and
every field must be byte-identical across runs or the product sees a brand-new test rather than another
run of an existing one.

So renaming a test, file, or directory — or moving a package, renaming a variant, changing the
attributed repository — loses history. Free before a story's first upload, expensive after; if you do it
to something already reporting, say so in the commit message.

Hence the configs root themselves at the **repository**: both runners resolve `file` and `classname`
against their root, and rooted at the package every `canonical.test.ts` reports identical values.

## Determinism

- **No unseeded randomness.** Seeds are derived: `hash(story, time bucket)`.
- **`synth/` uses FNV-1a and ChaCha8**, stable across versions and platforms, which `DefaultHasher` and
  `StdRng` are not. Golden-value tests pin the hash.
- **Every window is relative to now.** History ages out after roughly 60 days, so a fixed date rots and
  a fork of it is born rotten. Where a story needs a discoverable date, use a recurring rule.

## Configuration belongs to `synth/`

`monitors/` and `apps/` read no repository variables. Rates, windows, and thresholds are constants in
the test files, so a story is readable without cross-referencing settings — and a reviewer can tell what
it does from the file alone. CI facts like `GITHUB_REF_NAME` are not configuration and are fine to read.

`synth/` is where behavior is tuned from variables, because its whole job is producing volume and
distributions a fork will want to change.

## Layout invariants

**No language level.** `monitors/` and `apps/` are TypeScript, `synth/` is Rust; language is implied by
purpose. A story needing a second language gets a new top-level directory.

**File suffix selects the runner.** `*.test.ts` is vitest, `*.spec.ts` is playwright. With no language
directory between them each runner's default glob claims both sets, so both configs declare explicit
include/exclude.

**Manifests are per package; lockfiles are not.** One `package.json` per story and one `Cargo.toml` per
`synth/` subdirectory, but exactly one `pnpm-lock.yaml` and one `Cargo.lock`, both at the root.

**The workspace globs are load-bearing.** A directory matched by neither `pnpm-workspace.yaml` nor
`members = ["synth/*"]` is invisible: no install, no CI, and it fails quietly. Check both, plus
`.github/dependabot.yml`, whenever you add a directory. Cargo **errors** on a nested package that is
neither a member nor excluded.

Tooling a story needs but is not itself a story goes in [`integrations/`](integrations/) — the playwright
JUnit post-processor lives there rather than being copied into the packages that call it.

**Adding a story requires no CI edit.** The composite actions iterate workspace members with
`pnpm --filter`, so editing a workflow to add a story means something has drifted.

## Linting and formatting

Trunk drives both, with `trunk-fmt-pre-commit` and `trunk-check-pre-push` enabled.

```bash
trunk fmt
trunk check --all
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

## Uploads

Results reach the product through `@trunk-io/analytics-uploader`.

**The uploader owns the job's exit code, not the test process.** Test steps run under
`continue-on-error` and their outcome is handed to the uploader through `previous-step-outcome`; it exits
zero when every failure is quarantined and non-zero when one is not. A red job therefore means "not
quarantined yet" rather than "the tests failed", which is the only version of red worth acting on here.

Quarantining itself is left to the org's configuration rather than forced off in the actions — this repo
exists to exercise auto-quarantine.

**Branch class is derived, not set.** The precedence and the illegal pairs are in
[`synth/branch-rates`](synth/branch-rates/README.md). One trap worth knowing anywhere: protected matching
is **exact, not glob**, so `release/*` looking like a protected pattern does not make `release/1.4.2`
protected — the usual reason a run intended as `PB` arrives as `NONE`.

## What you cannot verify locally

Verify what you can before claiming anything:

```bash
trunk check --all
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

With `TRUNK_ANALYTICS_CLI` set, `cargo test` also runs generated JUnit through the uploader's own
`validate` subcommand ([`CONTRIBUTING.md`](CONTRIBUTING.md)).

You **cannot** verify that a monitor fired, that a detection resolved, or that a 14-day lifecycle
behaved. Never report a story as working because its tests run: say what was verified, what was not, and
what a human should check and when.

## Public repo

Treat everything committed as published. No internal repo paths, service names, database names, or URLs
— in code, comments, docs, or commit messages. No secrets, tokens, org slugs, or collection IDs in
tracked files.
