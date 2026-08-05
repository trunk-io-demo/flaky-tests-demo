# Conventions for iterating on this repo

Scoped conventions live next to the code they govern — [`monitors/CLAUDE.md`](monitors/CLAUDE.md) covers
the monitor stories. This file is the repo-wide set.

**The unit of work is a story:** a test, or a stream of synthetic results, whose job is to trip exactly
one monitor in a way a reader recognizes without reading the implementation. A change that makes a story
harder to recognize is a regression even if the tests still pass.

## Test identity, and what breaks it

Identity is the tuple of **repository, `file`, `classname`, suite path, `name`, and `variant`**, and every
field must be byte-identical across runs or the product sees a brand-new test rather than another run of
an existing one.

So renaming a test, file, or directory — or moving a package, renaming a variant, changing the attributed
repository — loses history. Free before a story's first upload, expensive after; if you do it to something
already reporting, say so in the commit message so the gap is attributable.

Hence the configs root themselves at the **repository**: both runners resolve `file` and `classname`
against their root, and rooted at the package every `canonical.test.ts` reports identical values.

## Determinism is a requirement, not a nicety

A story has to differ between runs to have a rate, and reproduce exactly for a fork to tell the same
story — which is what makes this a regression fixture and not only a demo.

- **No unseeded randomness.** Seeds are derived: `hash(story, time bucket)`.
- **`synth/` uses FNV-1a and ChaCha8**, stable across versions and platforms, which `DefaultHasher` and
  `StdRng` are not. Golden-value tests pin the hash, so reseeding every fork is a decision, not a
  refactor.
- **Every window is relative to now.** History ages out after roughly 60 days, so a fixed date rots and
  a fork of it is born rotten. Where a story needs a discoverable date, use a recurring rule.

## Layout invariants

**No language level.** `monitors/` and `apps/` are TypeScript, `synth/` is Rust; language is implied by
purpose. A story needing a second language gets a new top-level directory.

**File suffix selects the runner.** `*.test.ts` is vitest, `*.spec.ts` is playwright. With no language
directory between them each runner's default glob claims both sets, so both configs declare explicit
include/exclude.

**Manifests are per package; lockfiles are not.** One `package.json` per story and one `Cargo.toml` per
`synth/` subdirectory, but exactly one `pnpm-lock.yaml` and one `Cargo.lock`, both at the root.

**The workspace globs are load-bearing.** A directory matched by neither `pnpm-workspace.yaml` nor
`members = ["synth/*"]` is invisible: no install, no CI, and it fails quietly — the story simply never
runs. Check both, plus `.github/dependabot.yml`, whenever you add a directory. Cargo **errors** on a
nested package that is neither a member nor excluded.

**Adding a story requires no CI edit.** The composite actions iterate workspace members with
`pnpm --filter`, so editing a workflow to add a story means something has drifted.

## Documentation

Two kinds of file, and the split is what keeps either one useful:

| File        | Enumerates                                 | Audience                          |
| ----------- | ------------------------------------------ | --------------------------------- |
| `README.md` | **what** a thing is, and **why** it exists | Anyone who lands on the directory |
| `CLAUDE.md` | **how** to develop in it                   | Whoever is changing the code      |

READMEs render at every directory level on GitHub, which is what we want for the what-and-why.
Conventions and gotchas belong in a `CLAUDE.md` — a visitor reading a story should not have to skip past
them.

Every monitor and app scenario has a README covering what it detects, its mechanism, and what to expect
in the product and when. **Cross-link both directions**, and land docs with the code.

## Linting and formatting

Trunk drives both, with `trunk-fmt-pre-commit` and `trunk-check-pre-push` enabled: formatting applies on
commit, checks run before a push.

```bash
trunk fmt      # or: pnpm format
trunk check    # or: pnpm lint
```

Two omissions in `.trunk/trunk.yaml`, with reasons recorded there: `oxlint`/`oxfmt` fight prettier over
the same files, and the plugin pins `clippy`/`rustfmt` to a Rust that cannot build this workspace —
cargo owns Rust.

## Uploads

Results reach the product through `trunk-io/analytics-uploader`. `monitors/` and `apps/` use the
action; `synth/` drives the same CLI directly, since one run performs many uploads and each needs its
own attribution. That attribution is passed with `env K=V` rather than exported, so a variant or PR
number set for one upload cannot leak into the next and silently retag a test.

**The test process's exit code is deliberately not forwarded**, so a deliberate failure cannot turn a job
red and a job's status reports upload health only — which is what makes it usable as a canary.
Quarantining itself is left to the org's configuration rather than forced off in the actions.

**Branch class is derived, not set.** Configuration expresses a desired class and the generator produces
naming that yields it; the precedence and the illegal pairs are in
[`synth/branch-rates`](synth/branch-rates/README.md). One trap worth knowing anywhere: protected matching
is **exact, not glob**, so `release/*` looking like a protected pattern does not make `release/1.4.2`
protected — the usual reason a run intended as `PB` arrives as `NONE`.

## What you cannot verify locally

Verify what you can before claiming anything — tests run, JUnit is well-formed, the uploader parses it
without warnings, attribution lands:

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

Treat everything committed as published. No internal repo paths, service names, database names, or URLs —
in code, comments, docs, or commit messages. Describe _what a behavior must satisfy_, never which system
enforces it. No secrets, tokens, org slugs, or collection IDs in tracked files: those come from
repository variables and secrets at runtime.
