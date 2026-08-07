# `github-uptime`

> [!NOTE]
> **Depends on a third party.** These fail when GitHub has a problem, or when enough strangers file
> issues. Confirm at <https://www.githubstatus.com> before treating a failure as ours.

## What this demonstrates

A real external dependency causing real intermittency. Every other story here is something we made
happen; this one tracks whether GitHub is actually up and busy.

No generator produces this. Real dependencies fail in shapes nobody thinks to simulate, at times nobody
would pick, for durations nobody would choose — a 40-minute partial degradation at 06:00 on a Tuesday is
not a distribution anyone writes down.

## The tests

| File                                                     | Test                                                     | Goes red when                                                  |
| -------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| [`status-page.test.ts`](__tests__/status-page.test.ts)   | `github reports no incident at or above major right now` | The status page says `major` or `critical`.                    |
|                                                          | `github opened no incident in the last 24 hours`         | Any incident overlapped the last 24 hours.                     |
| [`issue-volume.test.ts`](__tests__/issue-volume.test.ts) | `actions/runner opened fewer than 4 issues this week`    | The weekly issue count reaches 1.25× that repository's median. |
|                                                          | `github/gh-stack opened fewer than 10 issues this week`  | Same, at its own median.                                       |
|                                                          | `github/docs opened fewer than 29 issues this week`      | Same again.                                                    |
| [`reachability.test.ts`](__tests__/reachability.test.ts) | `github.com answers`                                     | DNS or the network on the runner.                              |
|                                                          | `the latest analytics-cli release downloads`             | The release is missing, or the download does not complete.     |
| [`healthcheck.test.ts`](__tests__/healthcheck.test.ts)   | `healthcheck always passes`                              | Never.                                                         |

Split by concern rather than kept in one file: each reads a different source, and vitest's
`classnameTemplate: "{filename}"` means the split shows up in the product as separate classes.

## The two shapes here

**Incidents are rare and long.** Long quiet stretches, then everything goes red at once for an hour.
`no incident in the last 24 hours` stays red after the status page has gone green again, so the two status
tests recover at different times — deliberately.

**Issue volume is a block, not a coin flip.** Each threshold is **1.25×** that repository's median weekly
issue count over six or seven measured weeks, so a merely median week stays green and only a busier one
lands above — but the count barely moves inside a week. Hourly runs therefore see days of red, then days of
green. That is a slow square wave rather than a per-run rate, and it is the closest thing here to how a real
regression reads: a long block of failures that ends when something outside the suite changes.

The 25% of headroom is why the red blocks are rarer than the green ones. At the bare median about half of
weeks tripped, which reads as a threshold set at the middle of normal; a quarter above it says the week was
genuinely busy. The threshold is rounded up — counts are integers, so `< ceil(1.25 × median)` is exactly
`< 1.25 × median` and the test name stays a whole number.

Worth knowing: **the three issue tests are not independent.** A busy week on GitHub is busy across all
three repositories, so they tend to fail together — a correlated failure across distinct tests, which is
what separates a failure count from a failure rate.

## Maintaining the medians

The medians came from six or seven weekly samples each — 3, 8 and 23 — and the tests compare against
1.25× them: 4, 10 and 29. They drift; `github/docs` ranged from 19 to 42 over that span. When one sits
permanently on one side, re-measure the median rather than reading it as a signal:

```bash
since=$(date -u -d '7 days ago' +%F)
for repo in actions/runner github/gh-stack github/docs; do
  curl -s "https://api.github.com/search/issues?q=repo:$repo+type:issue+created:>=$since&per_page=1" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["total_count"])'
done
```

## Rate limits

Issue counts go through [`@octokit/rest`](https://github.com/octokit/rest.js), which is the client the
endpoint is documented against — it also means `advanced_search` is set, and GitHub is retiring the search
backend that runs without it. The status page and reachability checks use plain `fetch`: Statuspage is not
a GitHub API and a release download is not either.

The search API allows 10 requests a minute unauthenticated, per IP, shared with everything else on the
runner. `GITHUB_TOKEN` lifts it to 30 where present.

**Issue volume is not allowed to fail for a rate limit**, because a limit says nothing about GitHub's
health. Three things make that structural rather than hopeful:

1. `@octokit/plugin-throttling` and `@octokit/plugin-retry` **wait the limit out** — up to 70 seconds, which
   is wider than a search window, so a limit that will clear is simply waited through rather than reported.
2. All three counts are fetched **before any test body runs**, at module scope and sequentially. By the time
   a test executes there is no request left to fail in.
3. If a count still never arrived, the group **skips** with a logged reason and the budget it started with.
   A skip says "not measured", which is true; a pass would not be.

The other tests here do fail on a rate limit, deliberately — they are not trying to return a measurement,
and a limit while reading a status page is worth seeing.

## Telling a real problem from a working monitor

1. Open <https://www.githubstatus.com>. If GitHub is degraded, the monitor worked.
2. `healthcheck always passes` touches no network. Green means our suite is fine and the dependency is not.
3. `github.com answers` is the crudest check. Red means the runner's network, and it explains every other
   failure in the package.
4. Every failure message names its cause: the request did not complete, it was rate limited, or GitHub
   answered with something. Only the last is the story.

## Usage

```bash
pnpm --filter @flaky-tests-demo/apps-github-uptime test
```

Non-zero exit is expected — these fail on purpose. The report lands in `test-results/vitest.junit.xml`.
