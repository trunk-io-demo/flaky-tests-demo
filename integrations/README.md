# `integrations/` — deferred

Nothing lives here yet. This directory is reserved for one minimal test suite per test
framework, each existing only to demonstrate that the framework's JUnit output uploads
correctly. Conflicting dependency trees between frameworks is the entire point, so each suite
will carry its own `package.json`.

It is deliberately kept out of the current pass because framework breadth is not the story this
repo tells — see [`docs/architecture.md`](../docs/architecture.md) for why, and the predecessor
repo `trunk-io/flake-farm` for the framework-breadth version of this idea.

Two things are already in place so that landing it later needs no restructuring:

- `integrations/*` is matched by the globs in
  [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) and by the npm entry in
  [`.github/dependabot.yml`](../.github/dependabot.yml).
- A composite action at `.github/actions/integrations/` already exists, so wiring it into a
  workflow is one `uses:` line.

If a suite here needs Rust, it must be added to `members` or to `exclude` in the root
[`Cargo.toml`](../Cargo.toml) in the same commit. Cargo treats a nested package that is neither
as a hard error, not a warning.
