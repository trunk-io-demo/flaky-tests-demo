# flaky-tests-demo

A live demonstration of what each of Trunk's flaky-test
[monitors](https://docs.trunk.io/flaky-tests/detection/index#monitor-types) catches, and why you
would want it turned on.

Every directory in here is a _story_: a test, or a stream of synthetic test results, whose whole job
is to trip exactly one monitor in a way you can recognize at a glance. Land on a test, read its name
and its run history, and the monitor it exists for should be obvious.

This is not an application. It is a demo, and a canary — the same runs that make the demo compelling
are also the ones that tell the team owning these monitors whether detection latency and alert volume
still look right.

## How to read this repo

| Directory                        | What it is                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`monitors/`](monitors/)         | Seven packages, one per monitor. Each has a healthcheck that always passes plus tests that trip its monitor by obvious means. **Start here.**                  |
| [`apps/`](apps/)                 | Four scenarios of real tests against surfaces that genuinely misbehave — a time-of-day schedule, a monthly event, a shared rate limit, GitHub's actual uptime. |
| [`synth/`](synth/)               | Synthetic JUnit. Nothing executes; three Rust generators fabricate the run history that would otherwise take weeks of wall clock to accumulate.                |
| [`integrations/`](integrations/) | Deferred. Reserved for per-framework upload wiring.                                                                                                            |

Each top-level folder uploads to its own test collection, so its data can be read and retained
independently.

The layout is organized by **purpose, not by language**. There is no `typescript/` or `rust/` level:
`monitors/` and `apps/` are TypeScript, `synth/` is Rust, and that is a commitment rather than a
default.

## The catalog

### Monitors — [`monitors/`](monitors/)

| Monitor             | Story                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `failure-rate`      | [Three tests differing only in their percentage.](monitors/failure-rate/)                   |
| `failure-count`     | [Counts that swing with the branch class, plus two on a calendar.](monitors/failure-count/) |
| `skipped-test`      | [A serial cascade whose first failure skips the rest.](monitors/skipped-test/)              |
| `new-test`          | [One genuinely new test per day, on a rolling window.](monitors/new-test/)                  |
| `slow-test`         | [A gradual ramp, a bimodal spike, and a flat control.](monitors/slow-test/)                 |
| `pass-on-retry`     | [A retry ladder, in a single upload.](monitors/pass-on-retry/)                              |
| `timeout-inflation` | [A real timeout race, against a fail-fast control.](monitors/timeout-inflation/)            |

### Live scenarios — [`apps/`](apps/)

Real tests against surfaces we do not control, producing failure shapes that cannot be fabricated
convincingly.

| Scenario           | Demonstrates                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `parking-meter`    | [A periodic pattern no percentage-based rate can imitate.](apps/parking-meter/)                 |
| `mass-detection`   | [Alert volume and grouping: twenty tests fail together, one day a month.](apps/mass-detection/) |
| `third-party-apis` | [Failures that correlate across tests because a budget is shared.](apps/third-party-apis/)      |
| `github-uptime`    | [A real external dependency causing real intermittency.](apps/github-uptime/)                   |

### Synthetic arcs — [`synth/`](synth/)

The histories that take weeks of wall clock to accumulate for real.

| Capability               | Demonstrates                                                                 |
| ------------------------ | ---------------------------------------------------------------------------- |
| Dated cohorts            | [A test's full lifecycle: new, then established, then gone.](synth/cohorts/) |
| Failure rate per branch  | [Branch-filtered monitor configuration.](synth/branch-rates/)                |
| Failure rate per variant | ["Only flaky on macOS", from a Linux runner.](synth/variant-rates/)          |

## The pairings worth reading together

A single story demonstrates a monitor. A pair demonstrates why one monitor is not enough.

| Read                                     | Against                                            | To see                                                                                                           |
| ---------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [`slow-test`](monitors/slow-test/)       | [`timeout-inflation`](monitors/timeout-inflation/) | A test that got slower next to one that did not. A slow-test monitor fires on both; only one is worth profiling. |
| [`failure-rate`](monitors/failure-rate/) | [`failure-count`](monitors/failure-count/)         | The same failures read as a proportion and as a number.                                                          |
| [`parking-meter`](apps/parking-meter/)   | [`failure-rate`](monitors/failure-rate/)           | A 42% rate that is really a schedule, beside a 30% one that really is a rate.                                    |
| [`new-test`](monitors/new-test/)         | [`synth/cohorts`](synth/cohorts/)                  | The same lifecycle, live and synthetic, over different windows.                                                  |
| [`branch-rates`](synth/branch-rates/)    | [`variant-rates`](synth/variant-rates/)            | One test read through a branch filter, and through a variant.                                                    |

## If a monitor here fires, is something wrong?

Usually not — most of what happens here is the demo working, and every deliberate failure message says
so explicitly.

Three stories are deliberately alarming. Each is triageable in one lookup:

| Story              | Trigger                                                    | Confirm in one step                          |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------- |
| `mass-detection`   | Day 13 of every month, UTC                                 | Check the date. Its healthcheck stays green. |
| `third-party-apis` | GitHub's shared unauthenticated rate limit, 60/hour per IP | The failure message names the cause.         |
| `github-uptime`    | A real GitHub incident at or above `major`                 | Open <https://www.githubstatus.com>.         |

The one thing that **is** a real signal: a red hourly job. Quarantining is off and test outcomes do
not affect the job's exit code, so a red run means uploads are failing rather than that a demo test
failed on purpose.

## Running it

```bash
pnpm install
pnpm test            # every vitest story — expect failures, they are the point
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the rest: playwright stories, the `synth/` generators,
every tunable variable, and forking.

## A caveat worth stating up front

Most of what this repo asserts is only observable in the product, over hours or days. That the tests
pass locally says nothing about whether a monitor fired. Each story's README says what should appear
and roughly how long after a first run — sometimes minutes, sometimes fourteen days.

## Where else to look

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — running locally, configuration, forking
- [`CLAUDE.md`](CLAUDE.md) — conventions for changing anything here
- [`monitors/CLAUDE.md`](monitors/CLAUDE.md) — conventions specific to the monitor stories

## License

[MIT](LICENSE).
