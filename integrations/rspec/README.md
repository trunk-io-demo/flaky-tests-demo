# `integrations/rspec/`

RSpec upload wiring, through [`rspec_trunk_flaky_tests`](https://rubygems.org/gems/rspec_trunk_flaky_tests)
rather than the uploader. The plugin lives inside the rspec process: it records each example as it
finishes, looks up quarantine status on the first failure, and uploads when the run closes. There is no
JUnit, no report file, and no `analytics-uploader` step.

That makes it the one suite here where quarantining happens **in the test process**. Every other folder
runs its tests, then hands the outcome to the uploader, which decides the job's exit code. Here, a
quarantined failure is turned into a pass before rspec counts it, so rspec's own exit code already
means "not quarantined yet".

## What the suite covers

| Test                                                                    | Reports as                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `rspec upload shapes passes`                                            | `success`                                                  |
| `rspec upload shapes fails on characters that have to survive escaping` | `failure` carrying quotes, `&`, `<`, and emoji, every run  |
| `rspec upload shapes is skipped`                                        | `skipped`, via `skip:` metadata                            |
| `rspec upload shapes is pending and still failing`                      | `success`: a pending body that fails meets its expectation |
| `rspec quarantine fails 10 percent of runs`                             | `failure` in 10% of runs                                   |
| `rspec quarantine fails 30 percent of runs`                             | `failure` in 30% of runs                                   |
| `rspec quarantine fails 50 percent of runs`                             | `failure` in 50% of runs                                   |

The ladder is the story. Once a rung is quarantined its failures still upload, marked quarantined, but
rspec reports them as passing, and the job turns green once every failing test is quarantined. The rates
come from [`spec/support/seeded.rb`](spec/support/seeded.rb), a bit-for-bit port of
`monitors/utils/random.ts`. It is keyed on the test and the UTC hour, so a rerun inside the hour
reproduces exactly.

## Identity

`name` is the example's full description, `classname` is the file path dotted, and `file` is the path
rspec reports. So the script runs rspec from the **repository root**: `file` becomes
`./integrations/rspec/spec/…`, which is repo-relative and matches CODEOWNERS, and not `./spec/…`,
which would be the same for every rspec suite ever added. The spec directory is passed with
`--default-path`, which also puts it on the load path for `--require spec_helper`.

Unlike the Swift modes, the mode is **not** the variant. The four Swift modes need one to tell the
same tests apart; nothing else runs these, so the rows carry no variant.

## Versions

CI installs the plugin version named by the org variable `RSPEC_PRE_RELEASE_TEST_VERSION`, the gem's
counterpart to `ANALYTICS_CLI_PRE_RELEASE_TEST_VERSION`. It reaches the [`Gemfile`](Gemfile) as
`RSPEC_TRUNK_FLAKY_TESTS_VERSION`. Unset, empty, or `latest` means the newest stable release, because
bundler never picks a pre-release it was not asked for. Either spelling of a pre-release works, since
RubyGems reads `0.16.0-beta.1` as `0.16.0.pre.beta.1`.

That is also why there is no `Gemfile.lock`. A lockfile would pin the version the variable is there to
choose, so it is gitignored and bundler resolves on every install.

Ruby comes from the `ruby` runtime in [`.trunk/trunk.yaml`](../../.trunk/trunk.yaml), not from
`setup-ruby`. Trunk's runtime normally compiles Ruby from source with `ruby-build`. The `downloads`
override swaps in analytics-cli's stand-in, which has the same interface and fetches a prebuilt
[jdx/ruby](https://github.com/jdx/ruby) binary instead. The gem ships native builds for Ruby up to 4.0,
so there is no Rust toolchain to install either.

## What CI checks, and what it cannot

The plugin reports a failed upload on stdout and leaves rspec's exit code alone, so a run that uploads
nothing would otherwise stay green. In the `rspec` mode, the composite action's report check looks for
the plugin's `Flaky tests report upload complete` line instead of a file.

The plugin turns on when `TRUNK_ORG_URL_SLUG` and `TRUNK_API_TOKEN` are **set**, empty or not, so the
action unsets empty ones. On a fork's pull request, with no token, the plugin is off, nothing is
quarantined, and the job goes red on the deliberate failure. That is the same "not quarantined yet"
signal, just with nothing able to quarantine.

What a human has to confirm on the first runs:

- **Seven variant-less rows** appear in the integrations collection, with `file` set on every one.
- **The pending example reads as a pass**, and the skipped one as a skip, not as a failure.
- **Once a ladder rung is quarantined**, the log shows `Test is quarantined, overriding exception` for
  it, and the job goes green when no failure is left unquarantined.

## Running it

From the repository root, with Ruby from `trunk tools install`:

```bash
PATH="$PWD/.trunk/tools:$PATH" pnpm --filter @flaky-tests-demo/integrations-rspec run test:rspec
```

Without `TRUNK_ORG_URL_SLUG` and `TRUNK_API_TOKEN` the plugin does nothing and the run is plain rspec.
With them, set `TRUNK_LOCAL_UPLOAD_DIR` to write the bundle to disk rather than uploading it.
