# Conventions for iterating on this repo

Scoped conventions live next to the code they govern: [`monitors/CLAUDE.md`](monitors/CLAUDE.md)
covers the monitor stories. This file is the repo-wide set.

## The unit of work is a story

Every directory is one story or a set of them. A story is a test — or a stream of synthetic results —
whose job is to trip exactly one monitor in a way a reader recognizes without reading the
implementation.

A change that makes a story harder to recognize is a regression even if every test still passes.

## Test identity, and what breaks it

Identity is derived from the tuple of **repository, `file`, `classname`, suite path, `name`, and
`variant`**. Every field must be byte-identical across runs, or the product sees a brand-new test
rather than another run of an existing one.

So these are all history-losing operations:

- renaming a test, a test file, or a directory;
- moving a package;
- renaming a variant;
- changing the repository the results are attributed to.

Free before a story's first upload, expensive afterwards. If you do it to something that has already
been reporting, say so in the commit message so the gap in the data is attributable.

The corollary shows up in configs: both the vitest and playwright configs root themselves at the
**repository**, not the package, because both runners resolve `file` and `classname` against their
root. Rooted at the package, every `canonical.test.ts` in the repo reports identical values.

## Determinism is a requirement, not a nicety

A story has to differ between runs to have a rate at all, and has to reproduce exactly for a fork to
tell the same story as the original — that is what makes this repo a regression fixture and not only
a demo.

- **No unseeded randomness anywhere.** Seeds are derived: `hash(story, time bucket)`.
- **`synth/` uses FNV-1a and ChaCha8**, both stable across versions and platforms.
  `DefaultHasher` and `StdRng` explicitly are not. Golden-value tests pin the hash, so reseeding
  every story in every fork is a decision rather than a refactor.
- **Express every window relative to now, never as an absolute date.** Run history ages out after
  roughly 60 days, so a story pinned to a fixed date rots and a fork of it is born rotten.
  Where a story genuinely needs a discoverable date — the mass-detection event — use a recurring
  rule, which is computable from any date and never rots.

## Layout invariants

**No language level.** There is no `typescript/` or `rust/` directory. `monitors/` and `apps/` are
TypeScript, `synth/` is Rust, and language is implied by purpose. If a story needs a second language
it gets a new top-level directory with its own purpose, not a subdirectory.

**File suffix selects the runner.** `*.test.ts` is vitest, `*.spec.ts` is playwright. With no
language directory between them, each runner's default glob claims both file sets, so both configs
declare explicit include/exclude. This is required for the layout to work at all.

**Manifests are per package; lockfiles are not.** One `package.json` per story, one `Cargo.toml` per
`synth/` subdirectory, and exactly one `pnpm-lock.yaml` and one `Cargo.lock` at the root.

**The workspace globs are load-bearing.** A directory not matched by `pnpm-workspace.yaml`, or not
matched by `members = ["synth/*"]` in the root `Cargo.toml`, is invisible: no install, no
`pnpm --recursive`, no CI. It fails quietly — the story simply never runs. Check the globs whenever
you add a directory, and add it to `.github/dependabot.yml` too.

Two specific traps: Cargo **errors** on a nested package that is neither a member nor excluded, and
`integrations/*` is already in the pnpm globs despite holding no packages so that landing it later
needs no restructuring.

**Adding a story requires no CI edit.** The per-folder composite actions iterate workspace members
with `pnpm --filter` rather than naming paths. If you are editing a workflow to add a story,
something has drifted.

## Documentation is part of the deliverable

This repo's whole purpose is explaining things, so an undocumented story is an incomplete story.

- **`README.md`, not `CLAUDE.md`, for anything a visitor reads.** READMEs render at every directory
  level on GitHub, which is exactly the behavior we want. `CLAUDE.md` is for contributors changing
  the code.
- Every monitor and every app scenario has a `README.md` covering: what the monitor detects, the
  story in that folder and its mechanism, what you should see in the product and roughly when, and
  links up to the catalog and sideways to any deliberately overlapping story.
- **Cross-link both directions.** The catalog links down to each folder; each folder links back. A
  reader should never hit a dead end.
- Docs are updated in the same commit as the code, never deferred.

## Uploads

Results reach the product through `trunk-io/analytics-uploader`, invoked the way a customer would
invoke it. `monitors/` and `apps/` use it directly.

`synth/` is the exception, structurally: one run performs many uploads with different fabricated
attribution, and a composite action cannot loop a `uses:` step. So it resolves the same CLI once and
drives it directly, passing each upload's attribution with `env K=V` rather than exporting — an
exported variant or PR number would leak into the next upload and silently retag a test.

**Quarantining is off everywhere.** Every failure here is a story, so a quarantined failure is a
story that stopped being told. It also keeps the job status meaningful: a red run means uploads are
failing, not that a demo test failed on purpose.

**Branch class is derived, not set.** Configuration expresses a desired class and the generator
produces naming that yields it:

| Target  | Produced by                                   | Caveat                                          |
| ------- | --------------------------------------------- | ----------------------------------------------- |
| `MERGE` | a merge-queue prefix on the branch            | Wins over everything, including a set PR number |
| `PR`    | setting the PR-number override to an integer  | No real pull request required                   |
| `PB`    | a branch **exactly** matching a protected one | Warns if a PR number is also set                |
| `NONE`  | anything else                                 | The fallthrough                                 |

Protected matching is exact, not glob. `release/*` looking like a protected pattern does not make
`release/1.4.2` protected — this is the usual reason a run intended as `PB` arrives as `NONE`.

## What you cannot verify locally

You can verify that tests run, that JUnit is well-formed, that the uploader parses it without
warnings, and that attribution lands. Do that before claiming anything:

```bash
pnpm lint && pnpm format && pnpm typecheck
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

With `TRUNK_ANALYTICS_CLI` pointing at the uploader binary, `cargo test` additionally runs generated
JUnit through the uploader's own `validate` subcommand — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

You **cannot** verify that a monitor fired, that a detection resolved, or that a 14-day lifecycle
behaved. Never report a story as working on the basis that its tests run. Report what was verified,
state what remains unverified, and say what a human should look at and when.

## Public repo

Treat everything committed as published. No internal references in committed files — no internal
repo paths, service names, database or migration names, or internal URLs, in code, comments, docs, or
commit messages. Describe _what a behavior must satisfy_, never which internal system enforces it.

No secrets, tokens, org slugs, or collection IDs in tracked files. All of them come from repository
variables and secrets at runtime.
