# flaky-tests-demo

A live demonstration of what each of Trunk's flaky-test **monitors** catches, and why you would
want it turned on.

Every directory in here is a _story_: a test, or a stream of synthetic test results, whose whole
job is to trip exactly one monitor in a way you can recognize at a glance. Land on a test, read
its name and its run history, and the monitor it exists for should be obvious.

This is not an application. It is a demo, and a canary — the same runs that make the demo
compelling are also the ones that tell the team owning these monitors whether detection latency
and alert volume still look right.

## How to read this repo

| Directory                        | What it is                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`monitors/`](monitors/)         | Seven packages, one per monitor. Each has a healthcheck that always passes plus tests that trip its monitor by obvious means. **Start here.**                  |
| [`app/`](app/)                   | Four scenarios of real tests against surfaces that genuinely misbehave — a time-of-day schedule, a monthly event, a shared rate limit, GitHub's actual uptime. |
| [`synth/`](synth/)               | Synthetic JUnit. Nothing executes; three Rust generators fabricate the run history that would otherwise take weeks of wall clock to accumulate.                |
| [`integrations/`](integrations/) | Deferred. Reserved for per-framework upload wiring.                                                                                                            |
| [`docs/`](docs/)                 | The real documentation.                                                                                                                                        |

The layout is organized by **purpose, not by language**. There is no `typescript/` or `rust/`
level: `monitors/` and `app/` are TypeScript, `synth/` is Rust, and that is a commitment rather
than a default. See [`docs/architecture.md`](docs/architecture.md).

## Where to go next

- **"Which monitor does what, and which test shows it?"** → [`docs/monitors.md`](docs/monitors.md)
- **"How do I make it noisier, quieter, or bigger?"** →
  [`docs/configuration.md`](docs/configuration.md)
- **"I want my own copy of this."** → [`docs/forking.md`](docs/forking.md)
- **"Data stopped arriving."** → [`docs/operations.md`](docs/operations.md)
- **"How is it put together?"** → [`docs/architecture.md`](docs/architecture.md)

## Running it locally

```bash
pnpm install     # one lockfile resolves every workspace member
pnpm test        # every vitest story
pnpm test:e2e    # every playwright story
cargo test       # the synth generators' own tests

# a synth generator, writing JUnit XML and an upload manifest to ./synth-out
SYNTH_REPO_URL=https://github.com/your-org/your-fork cargo run -p cohorts
```

`SYNTH_REPO_URL` has no default on purpose: the repository name is part of every test's identity,
so a default would let a fork's synthetic runs merge into the original's test history.

Local runs upload nothing. Uploads need an org token, which only CI has, and which is absent by
design on pull requests from forks — those runs skip the upload with a log line rather than
failing.

## If a monitor here fires, is something wrong?

Usually not — most of what happens here is the demo working. Three stories are deliberately
alarming, and each is triageable in one lookup: [`docs/operations.md`](docs/operations.md) lists them
with their triggers. Every deliberate failure message also ends with a sentence saying so.

The one thing that _is_ a real signal: a **red hourly job**. Quarantining is off and test outcomes do
not affect the job's exit code, so a red run means uploads are failing rather than that a demo test
failed on purpose.

## A caveat worth stating up front

Most of what this repo asserts is only observable in the product, over hours or days. That the
tests pass locally says nothing about whether a monitor fired. Each story's README says what
should appear and roughly how long after a first run — sometimes minutes, sometimes fourteen
days.

## License

[MIT](LICENSE).
