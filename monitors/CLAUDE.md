# Conventions for `monitors/`

Repo-wide conventions are in [`../CLAUDE.md`](../CLAUDE.md), including the ten-comment-line limit.

## Keep the index current

Every test here is listed in [`README.md`](README.md). When you add, rename, or remove one, update that
index and the table in the package's own README. A test that exists but is not indexed is invisible; one
that is indexed but does not exist sends a reviewer looking for a story that is not there.

## Naming

- **Lowercase words separated by spaces.** `it("healthcheck always passes")`, not
  `healthcheck_always_passes`. Kebab only inside a token that is genuinely one — a date, a monitor name.
- **No numbers that could change.** `fails on a low rate`, not `fails 10 percent of runs`. The attempt
  counts in `pass-on-retry` are the exception: those are properties of the code.
- **Describe the mechanism, not the outcome**, wherever tuning could change the outcome.
  `protected branch member 01` rather than `always fails 01`.

## No repository variables

Rates, windows, and thresholds are constants in the test file. A reviewer should be able to tell what a
story does from the file alone, without cross-referencing repository settings. Configuration is a
`synth/` concern.

Reading CI facts is fine — `GITHUB_REF_NAME` is not configuration.

## Every package has a healthcheck

One test named `healthcheck always passes`, asserting `expect(1).toBe(1)` and nothing else.

Several monitors resolve when a test stops reporting, so "the monitor resolved" and "the suite stopped
running" look identical from outside. A green healthcheck separates them — which is why it must have no
other reason to fail.

## Renaming loses history

Identity includes `file`, `classname`, and `name`, so renaming a test, file, or directory creates a new
test and orphans the old one's history. Free before a story's first upload; say so in the commit message
after.

## Shared helpers live in `utils/`

| File        | Holds                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| `git.ts`    | `getBranch`, `getPrNumber`, `getBranchClass`.                                 |
| `date.ts`   | `now`, `getDay`, `getDate`, `getEpochDay`, `isEveryOtherDay`, `hourBucket`, … |
| `random.ts` | `randomPercentage`, over a seeded generator.                                  |

Depend on it with `"@flaky-tests-demo/monitors-utils": "workspace:*"`. It is a workspace member but not
a monitor — no tests, so `pnpm --filter --if-present` skips it.

- **`getBranchClass()` is how you ask where a run came from.** Three classes, no fallthrough: `MQ` for
  `trunk-merge/…` and `gh-readonly-queue/…`, `PB` for `main`/`master`/`develop`/`release`, `PR` for
  everything else. Order matters — a merge-queue branch is `MQ` even with a PR number set. Deliberately
  narrower than the uploader's four-class inference; on the branches CI actually runs, they agree.
- **`date.ts` is dayjs in UTC.** A local timezone makes a periodic story depend on daylight saving.

`junit-reporter.ts` is copied per package rather than shared, because a playwright reporter is resolved
by path from its config and a cross-package path couples two stories. Keep the copies byte-identical.

## Configs

- Both configs root themselves at the **repository**, not the package: `file` and `classname` resolve
  against the root, and rooted at the package every `canonical.test.ts` reports identical values.
- **`addFileAttribute: true`** on the vitest junit reporter. Off by default, and without it CODEOWNERS
  has nothing to match.

## Deliberate failures announce themselves

Every intentional failure message ends by saying so, so that somebody looking at a flagged test in the
product does not have to open the source to find out whether it was on purpose.
