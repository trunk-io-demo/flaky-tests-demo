import { describe as group, expect, it } from "vitest";

import { describe, isPaidParking, parseWindow } from "./schedule";

/**
 * A periodic failure pattern no percentage-based rate can imitate.
 *
 * Averaged over a week the story test below fails about 42% of runs — a number
 * that looks like ordinary flakiness and tells you nothing. Look at *when* and
 * the pattern is unmistakable. The aggregate is not merely less useful here, it
 * is actively misleading: 42% says the test is unreliable, while the run times
 * say the test is right and its assumption is wrong.
 */

const PAID_HOURS = parseWindow(process.env.APPS_PARKING_PAID_HOURS, {
  startHour: 8,
  endHour: 18,
});

group("parking-meter", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("parking is free right now", () => {
    const now = new Date();
    if (isPaidParking(now, PAID_HOURS)) {
      throw new Error(
        `deliberate failure: parking is not free at ${describe(now, PAID_HOURS)}. ` +
          `This is a schedule rather than a rate. The demo is working.`,
      );
    }
    expect(isPaidParking(now, PAID_HOURS)).toBe(false);
  });

  /** The inverse, so exactly one of the pair fails on every run: the suite's
   * total failure count is flat while its composition swings on a cycle, which
   * makes the same point to a count-based monitor. */
  it("parking costs money right now", () => {
    const now = new Date();
    if (!isPaidParking(now, PAID_HOURS)) {
      throw new Error(
        `deliberate failure: parking is free at ${describe(now, PAID_HOURS)}. ` +
          `This is the demo working.`,
      );
    }
    expect(isPaidParking(now, PAID_HOURS)).toBe(true);
  });

  /** The rule itself, for a reader who does not want to work out what time it is
   * in UTC. */
  it("the schedule is free on sundays and outside working hours", () => {
    const sundayNoon = new Date(Date.UTC(2026, 7, 2, 12, 0, 0));
    const mondayNoon = new Date(Date.UTC(2026, 7, 3, 12, 0, 0));
    const mondayNight = new Date(Date.UTC(2026, 7, 3, 22, 0, 0));

    expect(sundayNoon.getUTCDay()).toBe(0);
    expect(isPaidParking(sundayNoon, PAID_HOURS)).toBe(false);
    expect(isPaidParking(mondayNoon, PAID_HOURS)).toBe(true);
    expect(isPaidParking(mondayNight, PAID_HOURS)).toBe(false);
  });
});
