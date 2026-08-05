# Conventions for `synth/config`

Repo-wide conventions are in [`../../CLAUDE.md`](../../CLAUDE.md). One of them does not apply here.

## `parameters.rs` is exempt from the ten-comment-line limit

Every parameter carries a one- or two-line description of what it does and how it affects the durable and
churn populations. That is deliberate and should stay: the comments _are_ the documentation for a
declaration file, and moving them to [`README.md`](README.md) would separate each parameter from its own
description — the thing the merge into one file was meant to fix.

The limit still applies to [`src/lib.rs`](src/lib.rs) and [`src/clamp.rs`](src/clamp.rs).

## Where a parameter goes

| It is                                     | So it lives in                            |
| ----------------------------------------- | ----------------------------------------- |
| Volume or a rate a fork will want to tune | a `Var` in `parameters.rs`, read from env |
| Anything that changes what a story means  | a constant in `parameters.rs`             |
| Machinery for clamping either             | `clamp.rs`                                |

A new parameter is a bounded newtype declared next to its value, never a bare `u32`. If it can be out of
range at runtime it is in the wrong shape — that is what the bounds are for, and it is why this crate has no
`validate` step.

## Identity-affecting parameters must not become variables

`TESTS_PER_SUITE` decides a test's suite, which is part of its `classname`. Changing it re-identifies the
population, so it stays a constant where the change is reviewable. See
[`README.md`](README.md#changing-the-partition-changes-identity) for what each direction costs.
