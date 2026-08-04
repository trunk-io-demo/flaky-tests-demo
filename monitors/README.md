# `monitors/` — one package per monitor, one story each

Each directory here exists to trip exactly one monitor by transparently obvious means. Land on a
test, read its name and its run history, and the monitor it exists for should be recognizable
without reading the implementation.

Every package contains, at minimum:

- a **healthcheck test that always passes**, and
- a small number of tests that trip that monitor.

The healthcheck is not decoration. Several monitors resolve when a test stops reporting, so "the
monitor resolved" and "the suite stopped running" look identical from the outside. A green
healthcheck is what separates them.

| Monitor                          | Detects                                                | Status  |
| -------------------------------- | ------------------------------------------------------ | ------- |
| [`failure-rate/`](failure-rate/) | What fraction of recent runs failed.                   | landed  |
| `failure-count/`                 | How many failures in a window.                         | pending |
| `skipped-test/`                  | Tests that stopped running without being deleted.      | pending |
| `new-test/`                      | Tests that have not been around long enough to trust.  | pending |
| `slow-test/`                     | Duration regressions.                                  | pending |
| `pass-on-retry/`                 | A test that failed and then passed on the same commit. | pending |
| `timeout-inflation/`             | A test that only got slower when it fails.             | pending |

## Conventions

- **`*.test.ts` is vitest, `*.spec.ts` is playwright.** Both configs declare explicit
  include/exclude, because with no language directory between them each runner's default glob claims
  both file sets. See [`docs/architecture.md`](../docs/architecture.md).
- **Rates come from repository variables**, never from edited test code. Tuning the demo is a
  settings change.
- **Test names do not contain their numbers.** A name like `fails_10_percent_of_runs` starts lying
  the first time someone tunes the rate. Names describe the role; the numbers live in each package's
  README.
- **Outcomes are seeded, not random.** A story has to differ between runs to have a rate at all, and
  has to be reproducible for a fork to tell the same story. Seeding from the test name and the
  current hour gives both.
- **Adding a package requires no CI edit.** The composite action iterates workspace members, so a new
  directory with a `test` script is picked up by the next scheduled run — as long as it is matched by
  the globs in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml).

## Related

- [`docs/monitors.md`](../docs/monitors.md) — the catalog, with what each monitor should show and when
- [`docs/configuration.md`](../docs/configuration.md) — every variable
- [`docs/operations.md`](../docs/operations.md) — the evaluation windows that decide when a monitor
  can fire at all
