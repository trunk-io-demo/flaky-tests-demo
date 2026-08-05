import { describe, expect, it } from "vitest";

import { fetchStatus, isDegraded, parseThreshold } from "./status";

/**
 * ⚠️ **Depends on a third party.** This fails during a real GitHub incident, and
 * that is deliberate: every other story here is something we made happen, and no
 * generator produces a 40-minute partial degradation at 06:00 on a Tuesday.
 *
 * Triage in one step: open <https://www.githubstatus.com>, the same page this
 * reads. If GitHub is degraded, the monitor worked.
 *
 * Called once per run, with a timeout and a user-agent naming this repo.
 */

const THRESHOLD = parseThreshold(process.env.APPS_UPTIME_THRESHOLD);

describe("github-uptime", () => {
  /** Never touches the network, so it separates "the dependency is down" from
   * "our suite is down" — otherwise the same red. */
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("github is not reporting a major incident", async () => {
    const result = await fetchStatus();

    if (!result.ok) {
      throw new Error(
        `third-party dependency failure: could not read GitHub's status page ` +
          `(${result.reason}). Check https://www.githubstatus.com and the runner's ` +
          `network. This depends on a service we do not control.`,
      );
    }

    const { indicator, description, updatedAt } = result.reading;
    console.log(
      `github status: ${indicator} — ${description} (updated ${updatedAt})`,
    );

    if (isDegraded(indicator, THRESHOLD)) {
      throw new Error(
        `third-party dependency failure: GitHub reports "${indicator}" — ` +
          `${description}, at or above the configured threshold "${THRESHOLD}". ` +
          `This is a real incident on somebody else's service. The monitor worked.`,
      );
    }

    expect(isDegraded(indicator, THRESHOLD)).toBe(false);
  });

  /** Documents what the threshold means without waiting for an outage. */
  it("the severity threshold orders indicators correctly", () => {
    expect(isDegraded("critical", "major")).toBe(true);
    expect(isDegraded("major", "major")).toBe(true);
    expect(isDegraded("minor", "major")).toBe(false);
    expect(isDegraded("none", "major")).toBe(false);
    // A threshold of "none" would mean "fail always", so it is treated as off.
    expect(isDegraded("none", "none")).toBe(false);
  });
});
