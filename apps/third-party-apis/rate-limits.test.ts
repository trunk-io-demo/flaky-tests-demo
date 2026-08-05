import { describe, expect, it } from "vitest";

import { BURST, fetchBudget, spendBurst } from "./budget";

// ⚠️ Depends on a third party. Rate limiting produces a shape nothing else here
// does: every test needing the budget fails in the same run for the same reason,
// then all recover together at the top of the hour. The cause is shared state
// outside the suite, which no per-test rate models.
//
// Every failure names its cause: rate limited (the story), request failed (the
// runner's network), or budget unreadable (usually the first as well).

describe("third-party-apis", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("there is enough rate limit budget left to work with", async () => {
    const budget = await fetchBudget();

    if (!budget.ok) {
      throw new Error(
        `third-party dependency failure: could not read the rate-limit budget ` +
          `(${budget.reason}). This usually means the budget is exhausted too.`,
      );
    }

    const { limit, remaining, resetsAt } = budget.value;
    console.log(
      `github unauthenticated budget: ${String(remaining)}/${String(limit)}, ` +
        `resets ${resetsAt}`,
    );

    if (remaining < BURST) {
      throw new Error(
        `third-party dependency failure: rate limited. ${String(remaining)} of ` +
          `${String(limit)} remaining, fewer than the burst of ${String(BURST)}. ` +
          `Resets ${resetsAt}. The budget is per-IP and shared across everything on ` +
          `this runner, so this is usually not our doing.`,
      );
    }

    expect(remaining).toBeGreaterThanOrEqual(BURST);
  });

  it("a small burst of api calls all succeed", async () => {
    const outcome = await spendBurst(BURST);
    console.log(
      `burst of ${String(outcome.attempted)}: ${String(outcome.succeeded)} ok, ` +
        `${String(outcome.rateLimited)} rate limited, ${String(outcome.failed)} failed`,
    );

    if (outcome.rateLimited > 0) {
      throw new Error(
        `third-party dependency failure: rate limited part-way through a burst of ` +
          `${String(outcome.attempted)} (${outcome.firstReason ?? "unknown"}). ` +
          `Correlated failures that all recover together: the monitor worked.`,
      );
    }

    if (outcome.failed > 0) {
      throw new Error(
        `third-party dependency failure: ${String(outcome.failed)} of ` +
          `${String(outcome.attempted)} requests did not complete ` +
          `(${outcome.firstReason ?? "unknown"}). A network problem on the runner ` +
          `rather than a rate limit — different cause, same red.`,
      );
    }

    expect(outcome.succeeded).toBe(outcome.attempted);
  });
});
