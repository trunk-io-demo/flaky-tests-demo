import { daysAgoIso } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

import { countIssuesOpenedSince, searchBudget, type Repo } from "../src/issues";

// ⚠️ Depends on a third party. Each threshold is 1.25× that repository's median
// weekly issue count over six or seven measured weeks, so only a busier-than-usual
// week lands above it — and the count barely moves inside a week, so these go red
// for days at a time and then green for days: a block, not a coin flip. The ceiling
// costs nothing on integer counts and keeps the name whole. Medians drift; when one
// sits permanently on one side, re-measure it — maintenance rather than a signal.

const WINDOW_DAYS = 7;
const HEADROOM = 1.25;

const STORIES: readonly { repo: Repo; median: number }[] = [
  { repo: "actions/runner", median: 3 },
  { repo: "github/gh-stack", median: 8 },
  { repo: "github/docs", median: 23 },
];

const ceilingFor = (median: number): number => Math.ceil(median * HEADROOM);

// Counted before any test body runs, so a rate limit cannot fail one — there is
// nothing left running to fail. Sequential, because three concurrent searches
// would race the backoff the client is doing on our behalf.
const since = daysAgoIso(WINDOW_DAYS);
const budget = await searchBudget();
const counts = new Map<
  Repo,
  Awaited<ReturnType<typeof countIssuesOpenedSince>>
>();
for (const { repo } of STORIES) {
  counts.set(repo, await countIssuesOpenedSince(repo, since));
}

const limited = [...counts.values()].some(
  (counted) => !counted.ok && counted.rateLimited === true,
);
if (limited) {
  console.warn(
    `issue volume: skipped — the search budget ran out even after backing off ` +
      `(${budget.ok ? `${String(budget.value)} left before starting` : budget.reason}). ` +
      `The limit is 10 requests a minute per IP unauthenticated, shared with ` +
      `everything else on this runner. Not a signal.`,
  );
}

describe("issue volume", () => {
  it
    .skipIf(limited)
    .each(
      STORIES.map(
        ({ repo, median }) => [repo, ceilingFor(median), median] as const,
      ),
    )("%s opened fewer than %i issues this week", (repo, ceiling, median) => {
    const counted = counts.get(repo);

    if (counted === undefined || !counted.ok) {
      throw new Error(
        `third-party dependency failure: could not count issues in ${repo} ` +
          `(${counted?.reason ?? "not measured"}). Rate limits are handled ` +
          `separately, so this is something else.`,
      );
    }

    const opened = counted.value;
    console.log(
      `${repo}: ${String(opened)} issues opened since ${since}, ceiling ` +
        `${String(ceiling)} (${String(HEADROOM)}× median ${String(median)})`,
    );

    if (opened >= ceiling) {
      throw new Error(
        `third-party dependency failure: ${repo} opened ${String(opened)} ` +
          `issues since ${since}, at or above the ${String(ceiling)} its ` +
          `${String(median)} weekly median allows with ${String(HEADROOM)}× ` +
          `headroom. Nothing is broken — strangers filed issues. This is the ` +
          `story: real data we do not control, running hot against its own ` +
          `median.`,
      );
    }

    expect(opened).toBeLessThan(ceiling);
  });
});
