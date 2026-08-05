import { describe, expect, it } from "vitest";

import { burstSize, fetchBudget, MAX_BURST, spendBurst } from "./budget";

/**
 * ⚠️ **These tests depend on a third party.** They fail when GitHub's
 * unauthenticated rate limit is exhausted for this runner's IP, and that is
 * deliberate.
 *
 * ## Why this is here
 *
 * Rate limiting produces a failure shape nothing else in this repo does:
 * **failures that cluster in time and correlate across tests.** When the budget
 * runs out, every test that needs it fails, in the same run, and then they all
 * recover together at the top of the hour. No per-test rate models that, and no
 * generator produces it, because the cause is shared state outside the suite.
 *
 * ## How to tell "the monitor worked" from "we have a problem"
 *
 * Read the failure message. Every failure here names which of three things
 * happened:
 *
 * 1. **Rate limited** — the budget was gone. The monitor worked. GitHub's
 *    unauthenticated limit is 60 requests per hour *per IP*, and CI runners share
 *    IPs with everything else on the platform, so this happens for reasons that
 *    have nothing to do with us.
 * 2. **Request failed** — network or DNS on the runner. Not the story, and not
 *    GitHub's fault either.
 * 3. **Budget unreadable** — `GET /rate_limit` itself did not answer, which
 *    usually means the first case is also true.
 *
 * ## Politeness
 *
 * `GET /rate_limit` does not count against the limit it reports, so the budget is
 * observed for free every run. The burst that actually spends budget is small,
 * sequential, and capped — see budget.ts, which explains each choice.
 */

const BURST = burstSize();

describe("third-party-apis", () => {
  /**
   * Never fails, never touches the network.
   *
   * On a scenario whose failures come from outside, this is the only way to tell
   * "the dependency is unavailable" from "our suite is not running."
   */
  it("healthcheck_always_passes", () => {
    expect(BURST).toBeLessThanOrEqual(MAX_BURST);
  });

  /**
   * Reports the budget. Fails when there is not enough left to do the work.
   *
   * This is the test that makes the correlation legible: it fails for the same
   * reason as the one below, at the same moment, and recovers at the same moment.
   */
  it("there_is_enough_rate_limit_budget_left_to_work_with", async () => {
    const budget = await fetchBudget();

    if (!budget.ok) {
      throw new Error(
        `third-party dependency failure: could not read the rate-limit budget ` +
          `(${budget.reason}). This usually means the budget is exhausted too.`,
      );
    }

    const { limit, remaining, resetsAt } = budget.value;
    console.log(
      `github unauthenticated budget: ${String(remaining)}/${String(limit)} remaining, ` +
        `resets ${resetsAt.toISOString()}`,
    );

    if (remaining < BURST) {
      throw new Error(
        `third-party dependency failure: rate limited. ${String(remaining)} of ` +
          `${String(limit)} requests remaining, which is fewer than the burst of ` +
          `${String(BURST)} this scenario needs. Resets at ${resetsAt.toISOString()}. ` +
          `The budget is per-IP and shared across everything on this runner, so this ` +
          `is usually not our doing. The monitor worked.`,
      );
    }

    expect(remaining).toBeGreaterThanOrEqual(BURST);
  });

  /**
   * Spends a little budget and asserts every request landed.
   *
   * Sequential and small. A parallel burst would be a spike against somebody
   * else's service and would also make the outcome depend on connection
   * scheduling rather than on the budget, blurring the signal.
   */
  it("a_small_burst_of_api_calls_all_succeed", async () => {
    const outcome = await spendBurst(BURST);
    console.log(
      `burst of ${String(outcome.attempted)}: ${String(outcome.succeeded)} ok, ` +
        `${String(outcome.rateLimited)} rate limited, ${String(outcome.failed)} failed`,
    );

    if (outcome.rateLimited > 0) {
      throw new Error(
        `third-party dependency failure: rate limited part-way through a burst of ` +
          `${String(outcome.attempted)} — ${String(outcome.succeeded)} succeeded, ` +
          `${String(outcome.rateLimited)} were refused (${outcome.firstReason ?? "unknown"}). ` +
          `This is the shape the scenario exists to show: correlated failures that ` +
          `all recover together. The monitor worked.`,
      );
    }

    if (outcome.failed > 0) {
      throw new Error(
        `third-party dependency failure: ${String(outcome.failed)} of ` +
          `${String(outcome.attempted)} requests did not complete ` +
          `(${outcome.firstReason ?? "unknown"}). This is a network problem on the ` +
          `runner rather than a rate limit — different cause, same red.`,
      );
    }

    expect(outcome.succeeded).toBe(outcome.attempted);
  });

  /** The cap, asserted offline, so its existence is discoverable. */
  it("the_burst_size_is_capped", () => {
    expect(MAX_BURST).toBeLessThanOrEqual(20);
    expect(BURST).toBeGreaterThan(0);
  });
});
