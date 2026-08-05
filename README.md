# flaky-tests-demo

A live demonstration of what each of Trunk's flaky-test
[monitors](https://docs.trunk.io/flaky-tests/detection/index#monitor-types) catches.

Every directory is a _story_: a test, or a stream of synthetic results, whose job is to trip at least one
monitor in a way you recognize at a glance. Land on a test, read its name and its run history, and the
monitor it exists for should be obvious.

It is also a canary — the same runs that make the demo compelling tell the team owning these monitors
whether detection latency, classification, and quarantine behavior still look right.

| Directory                        | What it is                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`monitors/`](monitors/)         | One package per monitor. **Start here.**                                                                    |
| [`apps/`](apps/)                 | Real tests against surfaces that genuinely misbehave: a calendar, a monthly event, seventeen status pages.  |
| [`synth/`](synth/)               | Synthetic JUnit. Nothing executes; a Rust generator fabricates history that would take weeks to accumulate. |
| [`integrations/`](integrations/) | Tooling a story needs but that is not itself a story — currently a JUnit post-processor for playwright.     |

Each top-level folder uploads to its own test collection. Layout is by **purpose, not language** —
`monitors/` and `apps/` are TypeScript, `synth/` is Rust.

## The pairings worth reading together

A single story demonstrates a monitor; a pair shows why one monitor is not enough.

| Read                                         | Against                                            | To see                                                                       |
| -------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`slow-test`](monitors/slow-test/)           | [`timeout-inflation`](monitors/timeout-inflation/) | A test that got slower beside one that did not. Only one is worth profiling. |
| [`failure-rate`](monitors/failure-rate/)     | [`failure-count`](monitors/failure-count/)         | The same failures as a proportion and as a number.                           |
| [`parking-meter`](apps/parking-meter/)       | [`failure-rate`](monitors/failure-rate/)           | A rate that is really a calendar.                                            |
| [`third-party-apis`](apps/third-party-apis/) | [`failure-count`](monitors/failure-count/)         | Failures that correlate because the cause is outside every test.             |
| [`new-test`](monitors/new-test/)             | [`synth/`](synth/)                                 | The same lifecycle, live and synthetic.                                      |

## If a monitor here fires, is something wrong?

Usually not. Every deliberate failure message says so, and names its cause. Four stories look like a real
problem on purpose, each triageable in one lookup:

| Story              | Trigger                                      | Confirm                                      |
| ------------------ | -------------------------------------------- | -------------------------------------------- |
| `mass-detection`   | The 1st and the 15th, UTC                    | Check the date; its healthcheck stays green. |
| `parking-meter`    | A street-cleaning or event window            | The message prints the day, hour, and rule.  |
| `third-party-apis` | Any of seventeen services degraded           | The message links the status page it read.   |
| `github-uptime`    | A GitHub incident, or a busy week for issues | Open <https://www.githubstatus.com>.         |

**Red jobs are expected here**, and reading one takes a moment's care. The uploader owns each job's exit
code: it is handed the test step's outcome and exits zero when every failure is quarantined, non-zero when
one is not. So red means _"something failed that is not quarantined yet"_ — which for a repo whose whole
purpose is producing quarantine candidates is a normal state, not an alarm.

## Running it

```bash
pnpm install
pnpm test                    # monitors/ and apps/ — expect failures, they are the point
pnpm test:e2e                # the playwright stories
cargo run -p generate        # synth/, writes JUnit into synth-out/
cargo test                   # the generator's own tests, a gate rather than a story
```

Non-zero exit codes are expected throughout. Each directory's README has a Usage section with more.

[`CONTRIBUTING.md`](CONTRIBUTING.md) covers forking and configuration. [`CLAUDE.md`](CLAUDE.md) has the
conventions.

Most of what this repo asserts is only observable in the product, over hours or days. Each story's README
says what to expect and when.
