# Conventions for `monitors/`

Repo-wide conventions are in [`../CLAUDE.md`](../CLAUDE.md), including the ten-comment-line limit.

## Keep each package's README current

A package's own `README.md` is where its tests are enumerated. When you add, rename, or remove one, update
that table in the same commit. A test that exists but is not described is invisible; one that is described
but does not exist sends a reviewer looking for a story that is not there.

[`README.md`](README.md) here stays at the level of one row per monitor — what it detects and what the
story is. It deliberately does not index individual tests, because two places to update is one too many.

## Use `it.each` for a ladder, and printf for strings

A rung, a cohort, a step: `it.each` rather than a `for` loop around `it`, so the table of cases reads as
data. One gotcha decides which name form to use — `$var` runs a string through pretty-format and **quotes
it**, so `$name` becomes `'creates an order'` and the identity is not the name you wrote:

| Form                                | Renders                         |
| ----------------------------------- | ------------------------------- |
| `it.each(objects)("$rate percent")` | `10 percent` — numbers are fine |
| `it.each(objects)("$name")`         | `'creates an order'` — quoted   |
| `it.each(tuples)("%s")`             | `creates an order`              |

So: object form with `$var` when only numbers appear in the name, tuple form with `%s` when a string does.

Playwright has no `test.each`. A `for` loop over a table is the idiom there, and `cascade.spec.ts` needs
one anyway because the order is the story.

## No two tests with the same failure pattern

See [`../CLAUDE.md`](../CLAUDE.md). Where a group is needed, vary it: `sometimes fails PB 01` … `03`
fail at 10%, 20%, and 30%, not all at one rate.

## Naming

- **Lowercase words separated by spaces.** `it("healthcheck always passes")`, not
  `healthcheck_always_passes`. Kebab only inside a token that is genuinely one — a date, a monitor name.
- **State the number when the number is in the file.** `fails 30 percent`, `sometimes fails PB 20
percent`, `passes on the third attempt` — rates and counts are constants here, so nothing outside the
  file can make a name lie. A name must never claim something defined elsewhere: if a value ever moves
  back out to configuration, the number comes out of the name with it.
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

| File           | Holds                                                                         |
| -------------- | ----------------------------------------------------------------------------- |
| `git.ts`       | `getBranch`, `getPrNumber`, `getBranchClass`.                                 |
| `date.ts`      | `now`, `getDay`, `getDate`, `getEpochDay`, `isEveryOtherDay`, `hourBucket`, … |
| `random.ts`    | `randomPercentage`, over a seeded generator.                                  |
| `test-iter.ts` | `testIter`, the zero-padded members a ladder is built from.                   |

Depend on it with `"@flaky-tests-demo/monitors-utils": "workspace:*"`. It is a workspace member but not
a monitor — no tests, so `pnpm --filter --if-present` skips it.

- **`getBranchClass()` is how you ask where a run came from.** Three classes, no fallthrough: `MQ` for
  `trunk-merge/…` and `gh-readonly-queue/…`, `PB` for `main`/`master`/`develop`/`release`, `PR` for
  everything else. Order matters — a merge-queue branch is `MQ` even with a PR number set. Deliberately
  narrower than the uploader's four-class inference; on the branches CI actually runs, they agree.
- **`date.ts` is dayjs in UTC.** A local timezone makes a periodic story depend on daylight saving.

The playwright packages use the built-in JUnit reporter with `includeRetries: true`, which reports every
attempt as its own run. `testDir` is the repository root so that `classname` is repository-relative, and
`outputFile` is cwd-relative because that is what the reporter resolves against.

The reporter writes no `file` attribute, which the uploader needs for code-owner correlation, so
`test:e2e` pipes the report through `junit-add-file-attribute` from
[`integrations/playwright`](../integrations/playwright/). Keep the `status=$?` around it: these stories
fail on purpose and the post-step must not swallow the runner's exit code.

## Configs

- Both configs root themselves at the **repository**, not the package: `file` and `classname` resolve
  against the root, and rooted at the package every `canonical.test.ts` reports identical values.
- **`addFileAttribute: true`** on the vitest junit reporter. Off by default, and without it CODEOWNERS
  has nothing to match.

## Deliberate failures announce themselves

Every intentional failure message ends by saying so, so that somebody looking at a flagged test in the
product does not have to open the source to find out whether it was on purpose.
