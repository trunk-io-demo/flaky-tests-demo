import { describe, expect, it } from "vitest";

import { hourBucket, intFromEnv } from "./flake";

/**
 * The failure-count monitor watches how many failures happened in a window,
 * as an absolute number rather than as a proportion.
 *
 * That distinction is the whole reason this folder is separate from
 * `failure-rate`. A rate cannot see the difference between one test failing
 * half the time and twelve tests each failing half the time; a count can, and
 * the second one is what wakes somebody up.
 *
 * So this suite is a *burst*: a fixed set of members, of which the first
 * several fail on every single run. The count is deterministic — no draws, no
 * rate — which makes it the cleanest possible input to a threshold.
 */

const SUITE_SIZE = 12;
const FAILING = intFromEnv("MONITORS_FAILURE_COUNT", 4, 0, SUITE_SIZE);

describe("failure-count", () => {
  /** Never fails. See ../README.md for why every package has one. */
  it("healthcheck_always_passes", () => {
    expect(hourBucket()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
  });

  /**
   * Members are named by position rather than by outcome.
   *
   * `always_fails_03` would be a lie the moment someone lowered
   * `MONITORS_FAILURE_COUNT` to two — the test would still be called
   * always_fails and would sit there passing. The count is configuration, so
   * the names stay neutral and the README carries the number.
   */
  for (let index = 1; index <= SUITE_SIZE; index++) {
    const position = String(index).padStart(2, "0");

    it(`burst_member_${position}`, () => {
      if (index <= FAILING) {
        throw new Error(
          `deliberate failure: burst member ${position} of ${String(SUITE_SIZE)} is one of the ` +
            `first ${String(FAILING)}, which fail on every run (bucket ${hourBucket()}). ` +
            `This is the demo working, not a broken test.`,
        );
      }
      expect(index).toBeGreaterThan(FAILING);
    });
  }
});
