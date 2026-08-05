# `synth/` — run history without runs

Nothing here executes a test. These crates fabricate JUnit XML directly and upload it, which is the only
way to demonstrate arcs that take real wall clock to accumulate: a test's full lifecycle, a failure rate
that differs per branch, a failure that only happens on macOS.

**A story is an invocation, not a crate.** A workflow supplies the branch and pull request an upload claims
and the failure rate it runs at; the generator supplies the tests. That is why there is one binary rather
than one per story — a per-branch comparison is two invocations, not two code paths.

| Crate                    | Holds                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| [`config/`](config/)     | Every parameter a run reads, in a type that cannot hold a bad value.   |
| [`harness/`](harness/)   | Identity, seeded randomness, JUnit rendering, and the upload manifest. |
| [`generate/`](generate/) | The one binary. A story is an invocation of it, not a crate.           |

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

**Durable and disposable are separate populations.** The 48 durable tests are written out by hand and keep
their names forever, because their whole value is accumulated history. The churn tests get generated names
and are meant to disappear, which is what exercises resolution by absence and new-test detection at volume.
A generated name must never reach the durable set: a dependency bump that changed the word lists would
rename a test and orphan its history.

## Usage

Generate reports into `synth-out/`, uploading nothing:

```bash
cargo run -p generate                      # defaults: 48 tests, one run, one report
cargo run -p generate -- --out-dir /tmp/s  # somewhere else
```

Turn the dials with the same variables CI reads, which is how a story is chosen:

```bash
SYNTH_FAILURE_RATE=100 cargo run -p generate        # an all-failing upload
SYNTH_DURABLE_TEST_COUNT=500 \
  SYNTH_CHURN_TEST_COUNT=2000 \
  SYNTH_RUNS_PER_TEST=10 cargo run -p generate      # 25,000 cases across many reports
```

It prints what it decided and where it wrote:

```text
synth: bucket 2026-08-05T14
synth: 120 tests x 3 runs in 15 suites across 9 reports
synth: 360 cases, 48 failing at 12%
synth: wrote synth-out/junit-tests-00.xml
```

Every parameter and its range is in [`config/README.md`](config/README.md).

## Verifying locally

```bash
cargo test                                       # determinism, identity, bounds
cargo fmt --check && cargo clippy --all-targets -- -D warnings
```

With `TRUNK_ANALYTICS_CLI` set to an uploader binary, `cargo test` also runs generated JUnit through the
uploader's own `validate` subcommand, which parses it exactly as an upload would and sends nothing. That is
the check that catches malformed reports and stale or future timestamps. See
[`../CONTRIBUTING.md`](../CONTRIBUTING.md).

To validate by hand:

```bash
cargo run -p generate
trunk-analytics-cli validate $(printf -- '--junit-paths %s ' synth-out/*.xml)
```

Two runs are byte-identical within the same hour, which `--now` pins:

```bash
now="$(date -u +%Y-%m-%dT%H:00:00Z)"
cargo run -p generate -- --now "$now" --out-dir /tmp/a --quiet
cargo run -p generate -- --now "$now" --out-dir /tmp/b --quiet
diff -r /tmp/a /tmp/b && echo identical
```

**These tests are a gate, not a story.** They run beside `cargo fmt --check` and `pnpm typecheck` in the same
pull-request job, and their results are **deliberately never uploaded**: a failure here is a broken generator
rather than a story about flakiness. Only what `generate` writes reaches the product.

Report timestamps are what that check catches. A report stamped more than an hour ago warns as stale and a
case stamped later than now warns as a future timestamp, so reports are laid out to _end_ at generation
time and a story's dates live in its test names instead.
