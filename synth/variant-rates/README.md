# `synth/variant-rates` — "only flaky on macOS", from a Linux runner

## What this demonstrates

The story every team recognizes: a test that is fine everywhere except one platform.

It is normally expensive to demonstrate. macOS runner minutes cost roughly ten times what Linux
minutes cost, and the whole point is that the test runs _often_ enough for a rate to be visible —
so a faithful demo would be the most expensive thing in the repo.

Nothing here runs on macOS. A variant is a **field on the upload**, not a machine, so one Linux
runner fabricates the entire matrix. That is also a more honest demonstration of what a variant is.

| Variant   | Default rate | Role                                                                                       |
| --------- | ------------ | ------------------------------------------------------------------------------------------ |
| `linux`   | 3%           | The baseline. Quiet enough that a viewer would not look twice.                             |
| `macos`   | 34%          | The story.                                                                                 |
| `windows` | 12%          | In between, so "only flaky on macOS" is a claim about a distribution rather than a binary. |

The four tests are things that plausibly _are_ platform-sensitive — a file watcher, a clipboard
round trip, path separator normalization — so the story reads as a real platform bug rather than as
an arbitrary rate difference.

## Variant is part of test identity

The same test emitted under three variants is **three tests** in the product. That is what makes a
per-variant rate expressible at all, and it has one consequence worth knowing before you change
anything: renaming a variant does not rename a test, it creates a new one. The old variant's
history stays where it is and the new one starts empty.

All three variants share **one fabricated commit**, which is what a real matrix build produces and
what lets the product show three variants of a single change side by side.

## The healthcheck

`Healthcheck::variant_generator_is_reporting` is emitted under every variant. A variant going
silent is a resolution, and without a per-variant healthcheck you cannot tell "this variant had a
clean run" from "this variant stopped reporting."

## What you should see in the product

| When           | What                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Within an hour | Three runs of one commit, one per variant, with the same five test names under each.                 |
| Within a day   | 24 runs per variant — 96 samples per test per variant, enough for 3% and 34% to separate.            |
| Day 2 onward   | A failure-rate monitor scoped to `macos` fires while the same monitor scoped to `linux` stays quiet. |

## Configuration

| Variable                     | Default               | Effect                                         |
| ---------------------------- | --------------------- | ---------------------------------------------- |
| `SYNTH_VARIANT_RATE_LINUX`   | 3                     | Failure rate for the `linux` variant.          |
| `SYNTH_VARIANT_RATE_MACOS`   | 34                    | Failure rate for the `macos` variant.          |
| `SYNTH_VARIANT_RATE_WINDOWS` | 12                    | Failure rate for the `windows` variant.        |
| `SYNTH_VARIANTS`             | `linux,macos,windows` | Variant names, in the same order as the rates. |

Adding a variant name without adding a rate argument is refused at startup rather than silently
reusing the last rate — a variant emitting at a rate nobody configured is the kind of thing that
makes a demo wrong in a way nobody notices.

## Related

- [`../README.md`](../README.md) — how `synth/` works and how to verify it locally
- [`../branch-rates/README.md`](../branch-rates/README.md) — the same idea, but per branch
- [`../../docs/monitors.md`](../../docs/monitors.md) — the monitor catalog
- [`../../docs/configuration.md`](../../docs/configuration.md) — every variable
