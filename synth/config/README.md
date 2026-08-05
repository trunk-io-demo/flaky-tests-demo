# `synth/config` — every parameter, and the bound it is held to

One place to answer "what did this run actually do?" Five repository variables carry volume and rates;
everything that decides what a story _means_ is a constant. Both live in
[`src/parameters.rs`](src/parameters.rs), each with its range beside its value, so a reviewer can tell what
a run does from that one file rather than from repository settings.

## Every parameter

Each is a [`bounded-integer`](https://docs.rs/bounded-integer) newtype rather than a primitive or an alias,
so a constant out of range is a **compile error** and a `SkipRate` cannot be passed where a `FailureRate`
belongs. `Params` carries those types, so the harness receives values already proven in range instead of
trusting this crate.

| Parameter                                | Type                 | Range    | Means                                                                        |
| ---------------------------------------- | -------------------- | -------- | ---------------------------------------------------------------------------- |
| `SYNTH_FAILURE_RATE` **(var, 12)**       | `FailureRate`        | 0–100    | Share of runs a test fails.                                                  |
| `SYNTH_FLAKE_RATE` **(var, 5)**          | `FlakeRate`          | 0–100    | Share of runs a test fails then passes on a retry.                           |
| `SYNTH_RUNS_PER_TEST` **(var, 1)**       | `RunsPerTest`        | 1–100    | Times each test reports per upload, under one identity.                      |
| `SYNTH_DURABLE_TEST_COUNT` **(var, 48)** | `DurableTestCount`   | 1–20000  | Size of the durable population, whose names are index-derived.               |
| `SYNTH_CHURN_TEST_COUNT` **(var, 10)**   | `ChurnTestCount`     | 0–10000  | Size of the churn population, whose names are word-random and disposable.    |
| `SKIP_RATE` = 3                          | `SkipRate`           | 0–100    | Share of runs a test reports as skipped.                                     |
| `RATE_SPREAD` = 40                       | `RelativeRateSpread` | 0–90     | Deviation from the failure rate, **as a percentage of it**: `rate × 0.6…1.4` |
| `TESTS_PER_SUITE` = 8                    | `TestsPerSuite`      | 1–50     | Tests per suite. Part of `classname`, so part of identity.                   |
| `SUITES_PER_REPORT` = 6                  | `SuitesPerReport`    | 1–20     | Suites per report file. Pure packaging; touches no identity.                 |
| `FLAKE_RETRY_COUNT` = 2                  | `RetriesPerFlake`    | 1–10     | Failed attempts before a flaky test passes.                                  |
| `PASS_DURATION` = 1000 ± 300             | `MedianDurationMs`   | 1–600000 | Median of a passing case, and of a flake's final attempt.                    |
| `FAIL_DURATION` = 3000 ± 1000            | `DurationSpreadMs`   | 0–120000 | Median of a failing case. Slower than a pass on purpose.                     |
| `TIMEOUT_CEILING_DURATION` = 5000 ± 150  | —                    | as above | A flake's failed attempts: a tight cluster at a timeout.                     |

Variables **clamp and report** when out of range rather than failing the run: less volume is still correct
data, and a typo in a repository setting should not take down an hourly schedule. Unreadable values fall
back to the default the same way. Nothing else is validated at runtime, because nothing else can be wrong —
that is what the types are for.

`FAIL_DURATION` sits exactly on the boundary where three sigma reaches zero, so about one draw in 750 is
clipped by the 1ms floor. Widening the spread past 1000ms starts moving the median away from 3000ms.

## Why the rate spreads across a suite

Eight tests drawing on one rate are eight tests that fail on identical conditions — two rows of identical
data, which [`../../CLAUDE.md`](../../CLAUDE.md) rules out. So each test's own rate is the configured rate
spread `±RATE_SPREAD` across its suite: at 12% that is `7, 8, 9, 10, 12, 13, 14, 16`.

The band stops at the room a skip rate leaves rather than running past 100 and clamping. Clamping saturated
the top of the spread, so every rate above about 69% collapsed onto 100 and then collided with the skip rate.

Below about 10% the band is narrower than the suite and some tests share a rate. That **reports rather than
refusing** — the rate is a repository variable, and those tests still differ by duration and flakiness. The
rule is scoped to a suite: across suites rates repeat by design, because the durable set is a population
rather than 48 individual stories.

## A 100% failure rate

At 100% nothing passes, so a skip or a flake has no room to be: outcomes are one three-way split, and skips
and flakes take only what the failure rate leaves. The spread goes flat for the same reason. That is
arithmetic about the split, not a special case — it holds at 98% and 99% too.

It is the setting a workflow uses to produce an upload that
[infrastructure failure protection](https://docs.trunk.io/flaky-tests/detection/infrastructure-failure-protection)
excludes. **The threshold itself is configured in the product, not here**, so nothing in this crate goes
stale when an org changes it.

## Each population rounds up separately

Durable and churn tests are indexed from zero independently, so each rounds up to a whole suite of its own —
a partial durable suite is never topped up with churn tests. `suite_count()` is therefore
`ceil(durable / width) + ceil(churn / width)`, not `ceil(total / width)`. With 50 durable and 10 churn at a
width of 8 that is 7 + 2 = 9 suites, where one division over the total would say 8.

## Changing the partition changes identity

A test's identity is `index / TESTS_PER_SUITE` and `index % TESTS_PER_SUITE`, so a new test appears whenever
either dimension **grows** — more suites, or wider suites:

| Change                       | Kept | Orphaned | New |
| ---------------------------- | ---- | -------- | --- |
| count 48 → 96                | 48   | 0        | 48  |
| count 48 → 24, width 8 → 4   | 24   | 24       | 0   |
| width 8 → 4, count unchanged | 24   | 24       | 24  |
| width 8 → 10, count 48 → 60  | 48   | 0        | 12  |

So raising `SYNTH_DURABLE_TEST_COUNT` only appends, and narrowing the width while shrinking the count enough
to hold the suite count retires the tail without minting anything. Widening the width always mints, because
`test_08` and `test_09` did not exist before. `nothing_new_appears_unless_a_dimension_grows` in
[`../generate/src/plan.rs`](../generate/src/plan.rs) pins all four rows.

This is why `TESTS_PER_SUITE` is a constant and not a variable: re-partitioning is a reviewable code change,
not something a repository setting should do by accident.
