# `synth/` — run history without runs

Nothing in here executes a test. These crates fabricate JUnit XML directly and upload it, which is
the only way to demonstrate arcs that take real wall clock to accumulate: a test's full 30-day
lifecycle, a failure rate that differs per branch, a failure that only happens on macOS.

Uploads need no git history, no branch, and no pull request — every attribution field is supplied
explicitly.

| Crate                              | What it produces                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| [`junit-gen/`](junit-gen/)         | The shared library. Seeded generation, stable test identity, upload manifests. |
| [`cohorts/`](cohorts/)             | Dated test cohorts, long-lived and short-lived, that retire on schedule.       |
| [`branch-rates/`](branch-rates/)   | One failure rate per branch shape, so branch filters are distinguishable.      |
| [`variant-rates/`](variant-rates/) | One failure rate per variant, so "only flaky on macOS" costs no macOS minutes. |

## Why Rust, and why in process

JUnit generation is a Rust concern in the analytics toolchain. These crates build reports through
the `quick-junit` library rather than shelling out to a generator binary, so every option is set
programmatically from repository variables instead of being assembled into a command line.

## Determinism is a requirement

Seeds are derived, never random: `seed = hash(storyId, dateBucket)`. The data looks random,
reproduces exactly, and produces the same story in a fork as in the original. There is no unseeded
randomness anywhere in this directory.

Test identity — repository, file, classname, suite, name, variant — is owned explicitly rather
than generated, because a single differing byte makes the product see a new test instead of
another run of an existing one, and every story here depends on one test accumulating history.

Retirement is a feature: a cohort that stops being emitted is what exercises resolution by
absence. Retirement dates are therefore derivable from the cohort's own name and not tracked in
separate state — otherwise an unplanned gap in the schedule would be indistinguishable from an
intentional retirement.

## Verifying it locally

```bash
cargo test -p junit-gen
```

That covers determinism, identity stability, and the branch-class mapping. It does **not** cover
whether the uploader accepts the output, which is a separate and more useful check:

```bash
curl -sSL -o cli.tar.gz \
  https://github.com/trunk-io/analytics-cli/releases/latest/download/trunk-analytics-cli-x86_64-unknown-linux.tar.gz
tar xzf cli.tar.gz
TRUNK_ANALYTICS_CLI="$PWD/trunk-analytics-cli" cargo test -p junit-gen
```

With `TRUNK_ANALYTICS_CLI` set, the test suite runs generated reports through the uploader's own
`validate` subcommand, which parses them exactly as an upload would and reports nothing to any
server. The test is skipped with a printed note when the variable is unset, so a plain
`cargo test` needs no download.

Report timestamps are the thing this check catches. A report stamped more than an hour ago warns
as stale, and a case stamped later than now warns as a future timestamp — so reports are laid out
to _end_ at the moment they were generated, and a story's dates live in its test names instead.

What none of this verifies is whether a monitor fired. That is only observable in the product,
hours or days later.

## Related

- [`../CLAUDE.md`](../CLAUDE.md) — the identity constraint in full
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — `SYNTH_*` variables
- [`../README.md`](../README.md) — which monitor each capability demonstrates
