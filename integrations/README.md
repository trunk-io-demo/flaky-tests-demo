# `integrations/` — deferred

Nothing lives here yet. This directory is reserved for one minimal test suite per test framework, each
existing only to demonstrate that the framework's JUnit output uploads correctly. Conflicting dependency
trees between frameworks is the entire point, so each suite will carry its own `package.json`.

It is out of the current pass because framework breadth is not the story this repo tells — see the
predecessor repo `trunk-io/flake-farm` for the version of this idea that leads with it.

Four things are already in place so landing it needs no restructuring:

- `integrations/*` is in the globs in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) and in the npm entry
  of [`.github/dependabot.yml`](../.github/dependabot.yml).
- A composite action exists at `.github/actions/integrations/`, so wiring it in is one `uses:` line. It
  currently logs a notice, so it is a visible no-op rather than a silent one.
- If a suite here needs Rust it must be added to `members` or `exclude` in the root
  [`Cargo.toml`](../Cargo.toml) in the same commit. Cargo treats a nested package that is neither as a
  **hard error**.
