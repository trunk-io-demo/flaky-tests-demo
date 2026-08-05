# `synth/variant-rates` — "only flaky on macOS", from a Linux runner

The story every team recognizes, and normally the most expensive one to demonstrate: macOS runner minutes
cost roughly ten times Linux minutes, and a rate is only visible if the test runs often.

Nothing here runs on macOS. A variant is a **field on the upload**, not a machine, so one Linux runner
fabricates the entire matrix — which is also a truer demonstration of what a variant is.

| Variant   | Rate | Role                                                            |
| --------- | ---- | --------------------------------------------------------------- |
| `linux`   | 3%   | The baseline. Quiet enough that nobody looks twice.             |
| `macos`   | 34%  | The story.                                                      |
| `windows` | 12%  | In between, so the claim is about a distribution, not a binary. |

The four tests are things that plausibly _are_ platform-sensitive — a file watcher, a clipboard round trip,
path separator normalization — so it reads as a real platform bug rather than an arbitrary rate difference.

## Variant is part of test identity

The same test under three variants is **three tests**, which is what makes a per-variant rate expressible
at all. The consequence: renaming a variant does not rename a test, it creates a new one, and the old
variant's history stays where it is.

All three share **one fabricated commit**, the way a real matrix build does, so the product can show three
variants of a single change side by side.

## What you should see

Three runs of one commit within the hour, one per variant, with the same five test names under each. Within
a day, 96 samples per test per variant — enough for 3% and 34% to separate. From day two, a failure-rate
monitor scoped to `macos` fires while the same monitor scoped to `linux` stays quiet.

## Configuration

`SYNTH_VARIANT_RATE_{LINUX,MACOS,WINDOWS}` set the rates and `SYNTH_VARIANTS` the names, in the same order.
Adding a variant without adding a rate is refused at startup rather than silently reusing the last one.
