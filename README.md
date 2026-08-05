# flaky-tests-demo

A live demonstration of what each of Trunk's flaky-test
[monitors](https://docs.trunk.io/flaky-tests/detection/index#monitor-types) catches.

Every directory is a _story_: a test, or a stream of synthetic results, whose job is to trip exactly
one monitor in a way you recognize at a glance. Land on a test, read its name and its run history, and
the monitor it exists for should be obvious.

It is also a canary — the same runs that make the demo compelling tell the team owning these monitors
whether detection latency, classification, and quarantine behavior still look right.

| Directory                        | What it is                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [`monitors/`](monitors/)         | One package per monitor. **Start here.**                                                                                 |
| [`apps/`](apps/)                 | Real tests against surfaces that genuinely misbehave: a schedule, a monthly event, a shared rate limit, GitHub's uptime. |
| [`synth/`](synth/)               | Synthetic JUnit. Nothing executes; Rust generators fabricate history that would take weeks to accumulate.                |
| [`integrations/`](integrations/) | Deferred.                                                                                                                |

Each top-level folder uploads to its own test collection. Layout is by **purpose, not language** —
`monitors/` and `apps/` are TypeScript, `synth/` is Rust.

## The pairings worth reading together

A single story demonstrates a monitor; a pair shows why one monitor is not enough.

| Read                                     | Against                                            | To see                                                                       |
| ---------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`slow-test`](monitors/slow-test/)       | [`timeout-inflation`](monitors/timeout-inflation/) | A test that got slower beside one that did not. Only one is worth profiling. |
| [`failure-rate`](monitors/failure-rate/) | [`failure-count`](monitors/failure-count/)         | The same failures as a proportion and as a number.                           |
| [`parking-meter`](apps/parking-meter/)   | [`failure-rate`](monitors/failure-rate/)           | A 42% rate that is really a schedule.                                        |
| [`new-test`](monitors/new-test/)         | [`synth/cohorts`](synth/cohorts/)                  | The same lifecycle, live and synthetic.                                      |

## If a monitor here fires, is something wrong?

Usually not. Every deliberate failure message says so explicitly. Three stories look like a real problem
on purpose, each triageable in one lookup:

| Story              | Trigger                                    | Confirm                                      |
| ------------------ | ------------------------------------------ | -------------------------------------------- |
| `mass-detection`   | Day 13 of every month, UTC                 | Check the date; its healthcheck stays green. |
| `third-party-apis` | GitHub's shared rate limit, 60/hour per IP | The failure message names the cause.         |
| `github-uptime`    | A real GitHub incident at `major` or above | Open <https://www.githubstatus.com>.         |

A red hourly job **is** a real signal: test outcomes deliberately do not affect a job's exit code, so
red means uploads are failing.

## Running it

```bash
pnpm install
pnpm test     # expect failures — they are the point
```

[`CONTRIBUTING.md`](CONTRIBUTING.md) covers the rest. [`CLAUDE.md`](CLAUDE.md) has the conventions.

Most of what this repo asserts is only observable in the product, over hours or days. Each story's
README says what to expect and when.

## License

[MIT](LICENSE).
