import { describe, expect, it } from "vitest";

import { fetchStatus, isDegraded } from "./status";

// ⚠️ Depends on a third party: this fails during a real GitHub incident, on
// purpose. No generator produces a 40-minute degradation at 06:00 on a Tuesday.
// Triage in one step: open https://www.githubstatus.com, the page this reads.
// Called once per run, with a timeout and a user-agent naming this repo.

const THRESHOLD = "major" as const;

describe("github-uptime", () => {
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

    console.log(`github status: ${result.indicator} — ${result.description}`);

    if (isDegraded(result.indicator, THRESHOLD)) {
      throw new Error(
        `third-party dependency failure: GitHub reports "${result.indicator}" — ` +
          `${result.description}, at or above "${THRESHOLD}". This is a real ` +
          `incident on somebody else's service. The monitor worked.`,
      );
    }

    expect(isDegraded(result.indicator, THRESHOLD)).toBe(false);
  });

  it("the severity threshold orders indicators correctly", () => {
    expect(isDegraded("critical", "major")).toBe(true);
    expect(isDegraded("major", "major")).toBe(true);
    expect(isDegraded("minor", "major")).toBe(false);
    expect(isDegraded("none", "none")).toBe(false);
  });
});
