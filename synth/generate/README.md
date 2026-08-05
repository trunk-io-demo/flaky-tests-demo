# `synth/generate`

Writes JUnit XML. Runs no tests, uploads nothing, and sets no attribution — the uploader reads the branch,
commit, and author from the checkout, same as for `monitors/`.

A story is one invocation. The workflow picks the failure rate; this fills in the tests.

## Output

```text
synth-out/junit-tests-00.xml       one per report
synth-out/junit-tests-01.xml
synth-out/junit-healthcheck.xml    always separate
```

The healthcheck is its own report because a passing test would dilute a run set to fail 100%, and because
a healthcheck inside an excluded upload tells you nothing.

## Two populations

|                                          | Names                                                     | Meant to                                                |
| ---------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| **Durable** (`SYNTH_DURABLE_TEST_COUNT`) | derived from the index: `Suite01` / `Class01` / `test_05` | last, and accumulate history                            |
| **Churn** (`SYNTH_CHURN_TEST_COUNT`)     | word-random: `aggregate_value_added_e_services`           | come and go, exercising new-test and resolve-by-absence |

Generated names stay on the churn side. A generated name on a durable test would let a `fake` version bump
rename it and orphan its history.

## Shape and packing

`TESTS_PER_SUITE` (8) sets suite width. `SUITES_PER_REPORT` (6) sets how many suites go in a report file.
Each population rounds up to its own whole suite, so 50 durable and 10 churn is 7 + 2 = 9 suites, not 8.

`SYNTH_RUNS_PER_TEST` repeats every test under the same identity. A report never spans two runs.

Changing the suite width re-identifies tests, because the suite is part of `classname`. Raising a count only
appends. [`../config/README.md`](../config/README.md#changing-the-partition-changes-identity) has the table
for which direction costs what.

## Outcomes

Every case draws fail / skip / flake / pass from the configured rates, then a duration from the matching
distribution. Failures are slower than passes.

Flakes here are all one shape: the failed attempts draw from `TIMEOUT_CEILING_DURATION` and the final pass
from `PASS_DURATION`, so the two halves of a pair look nothing alike. That is the shape this generator is
configured for, not a claim about flakes in general — a flake that is slow on every attempt, or one that
never passes, would need a different `Outcome` than the harness currently emits.

At 100% failure there is no room left for a skip or a flake, so neither appears. See
[`../config/README.md`](../config/README.md#a-100-failure-rate).

## Fabricated paths

`classname` is `synth.fabricated.Suite01.Class01` and `file` is `synth/fabricated/suite01/class01.ts`.
Neither path exists. The `.ts` is deliberate: these sit beside the TypeScript tests from `monitors/` and
`apps/` in the product. Nothing resolves them, so CODEOWNERS matches nothing here.

## Exit code

Non-zero when the reports it wrote contain failures, zero otherwise — the same contract a test runner has.
Nothing failed to _generate_; the exit code describes the results, not the run. That is what lets CI hand
the outcome to the uploader and have it decide, exactly as it does for `monitors/` and `apps/`, instead of
`synth/` being permanently green while they go red for the same condition.

## Running it

```bash
cargo run -p generate                          # into synth-out/
cargo run -p generate -- --out-dir /tmp/synth
cargo run -p generate -- --quiet
cargo run -p generate -- --now "$(date -u +%Y-%m-%dT%H:00:00Z)"  # pin this hour's seeds
```

Every parameter is in [`../config/README.md`](../config/README.md);
[`../README.md`](../README.md#usage) has more examples.
