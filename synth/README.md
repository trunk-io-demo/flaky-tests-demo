# `synth/` — run history without runs

Nothing here executes a test. These crates fabricate JUnit XML directly and upload it, which is the only
way to demonstrate arcs that take real wall clock to accumulate: a test's full 30-day lifecycle, a failure
rate that differs per branch, a failure that only happens on macOS.

Uploads need no git history, no branch, and no pull request — every attribution field is supplied
explicitly.

| Crate                              | Produces                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| [`junit-gen/`](junit-gen/)         | The shared library: seeded generation, stable identity, upload manifests. |
| [`cohorts/`](cohorts/)             | Dated cohorts, long- and short-lived, that retire on schedule.            |
| [`branch-rates/`](branch-rates/)   | One failure rate per branch shape.                                        |
| [`variant-rates/`](variant-rates/) | One failure rate per variant.                                             |

This is also where configuration lives. `monitors/` and `apps/` read no repository variables; `synth/`
does, because its job is producing volume and distributions a fork will want to change.

## Two properties are load-bearing

**Identity is owned, not generated.** A test's identity comes from repository, `file`, `classname`, suite,
`name`, and `variant`. One differing byte makes the product see a new test rather than another run of an
existing one, and every story here depends on one test accumulating history. So identity is derived from
the story ID and never touches the RNG.

That rules out generic mock-report generation, which assigns a random `file` per case and pairs names with
classnames by independent shuffle.

**Seeds are derived, never random:** `hash(storyId, dateBucket)`. The data looks random, reproduces
exactly, and tells the same story in a fork as in the original — which is what makes this a regression
fixture and not only a demo.

Retirement is a feature: a cohort that stops being emitted exercises resolution by absence. Retirement
dates are derivable from the cohort's own name, because otherwise an unplanned gap in the schedule would
be indistinguishable from an intentional retirement.

## Verifying locally

```bash
cargo test
```

That covers determinism, identity stability, and the branch-class mapping. It does not cover whether the
uploader accepts the output — for that, see [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

Report timestamps are what that check catches. A report stamped more than an hour ago warns as stale and a
case stamped later than now warns as a future timestamp, so reports are laid out to _end_ at generation
time and a story's dates live in its test names instead.
