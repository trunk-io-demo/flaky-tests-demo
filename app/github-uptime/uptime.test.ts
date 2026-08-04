import { describe, expect, it } from "vitest";

import { fetchStatus, isDegraded, parseThreshold, STATUS_URL } from "./status";

/**
 * ⚠️ **These tests depend on a third party.** They fail during a real GitHub
 * incident, and that is deliberate.
 *
 * ## Why this is here
 *
 * Every other story in this repo is something we made happen. This one is not: its
 * outcome tracks whether GitHub is actually up. No generator produces that — real
 * external dependencies fail in shapes nobody thinks to simulate, at times nobody
 * would pick, and for durations nobody would choose.
 *
 * ## How to tell "the monitor worked" from "we have a problem"
 *
 * This will occasionally fire an alert because of somebody else's outage. That is
 * the point of the scenario, but it has to be triageable in one step:
 *
 * 1. Open https://www.githubstatus.com — the same page this test reads.
 * 2. If GitHub is degraded, the monitor worked. Nothing here is broken.
 * 3. If GitHub is fine but this is failing, the failure message says which of the
 *    two possible causes it was: the request did not complete, or the status was
 *    degraded. The first is a network or DNS problem on the runner; the second
 *    means the page and this test disagree, which is worth a look.
 *
 * ## Cadence
 *
 * Called **once per test run**, never in a loop, with a 10-second timeout and a
 * user-agent that identifies this repo. The endpoint is Statuspage's summary JSON,
 * which exists to be polled — but hourly is already generous, and there is no
 * version of this story that needs it more often.
 */

const THRESHOLD = parseThreshold(process.env.APP_UPTIME_THRESHOLD);

describe("github-uptime", () => {
  /**
   * Never fails, and never touches the network.
   *
   * On this scenario the healthcheck earns its keep twice over: it separates "the
   * dependency is down" from "our suite is down", which are otherwise the same
   * red.
   */
  it("healthcheck_always_passes", () => {
    expect(STATUS_URL).toContain("githubstatus.com");
  });

  /**
   * The story. Fails when GitHub says it is degraded, or when we cannot ask.
   *
   * Both are legitimate failures of "can I depend on GitHub right now", which is
   * the question a test that depends on GitHub is implicitly asking every time it
   * runs.
   */
  it("github_is_not_reporting_a_major_incident", async () => {
    const result = await fetchStatus();

    if (!result.ok) {
      throw new Error(
        `third-party dependency failure: could not read GitHub's status page ` +
          `(${result.reason}). Check https://www.githubstatus.com and the runner's ` +
          `network. This test depends on a service we do not control.`,
      );
    }

    const { indicator, description, updatedAt } = result.reading;
    console.log(
      `github status: ${indicator} — ${description} (updated ${updatedAt})`,
    );

    if (isDegraded(indicator, THRESHOLD)) {
      throw new Error(
        `third-party dependency failure: GitHub reports "${indicator}" — ` +
          `${description}, at or above the configured threshold of "${THRESHOLD}". ` +
          `This is a real incident on somebody else's service. The monitor worked. ` +
          `Confirm at https://www.githubstatus.com.`,
      );
    }

    expect(isDegraded(indicator, THRESHOLD)).toBe(false);
  });

  /**
   * The severity ladder, asserted offline.
   *
   * Always passes. It documents what the threshold means without anyone having to
   * wait for an outage to find out.
   */
  it("the_severity_threshold_orders_indicators_correctly", () => {
    expect(isDegraded("critical", "major")).toBe(true);
    expect(isDegraded("major", "major")).toBe(true);
    expect(isDegraded("minor", "major")).toBe(false);
    expect(isDegraded("none", "major")).toBe(false);
    // A threshold of "none" would mean "fail always", so it is treated as off.
    expect(isDegraded("none", "none")).toBe(false);
  });
});
