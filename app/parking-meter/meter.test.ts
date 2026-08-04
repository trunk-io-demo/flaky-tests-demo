import { describe as group, expect, it } from "vitest";

import { describe, isPaidParking, parseWindow } from "./schedule";

/**
 * A failure pattern that is periodic and predictable, and that **no
 * percentage-based rate can imitate**.
 *
 * This is the scenario for the gap in aggregate reporting. Averaged over a week,
 * the meter test below fails about 42% of runs — a number that looks exactly
 * like ordinary flakiness and that tells you nothing. Look at *when* it fails
 * and the pattern is unmistakable: never on a Sunday, never before 08:00, never
 * after 18:00.
 *
 * A monitor reporting only a rate cannot distinguish this from a coin flip. That
 * is what makes it worth having in the demo: it is the case where the aggregate
 * is not merely less useful than the detail, it is actively misleading.
 *
 * Nothing here is mocked. The tests read the real clock and assert real
 * behavior, so their history is a genuine time series rather than a simulated
 * one.
 */

const PAID_HOURS = parseWindow(process.env.APP_PARKING_PAID_HOURS, {
  startHour: 8,
  endHour: 18,
});

group("parking-meter", () => {
  /** Never fails. Distinguishes the pattern from the suite going quiet. */
  it("healthcheck_always_passes", () => {
    expect(PAID_HOURS.startHour).toBeLessThan(PAID_HOURS.endHour);
  });

  /**
   * The story: parking is free, and this test believes it.
   *
   * It fails whenever parking actually costs money — which is a schedule, not a
   * probability. Two runs an hour apart can differ; two runs a week apart
   * cannot.
   */
  it("parking_is_free_right_now", () => {
    const now = new Date();
    if (isPaidParking(now, PAID_HOURS)) {
      throw new Error(
        `deliberate failure: parking is not free at ${describe(now, PAID_HOURS)}. ` +
          `This test only fails inside the paid window, which is a schedule rather ` +
          `than a rate. This is the demo working, not a broken test.`,
      );
    }
    expect(isPaidParking(now, PAID_HOURS)).toBe(false);
  });

  /**
   * The inverse, so both halves of the schedule are represented.
   *
   * Exactly one of these two tests fails on any given run, which makes the
   * suite's total failure count perfectly flat while its *composition* swings
   * on a cycle. A count-based monitor sees nothing at all here.
   */
  it("parking_costs_money_right_now", () => {
    const now = new Date();
    if (!isPaidParking(now, PAID_HOURS)) {
      throw new Error(
        `deliberate failure: parking is free at ${describe(now, PAID_HOURS)}. ` +
          `This test only fails outside the paid window. This is the demo working.`,
      );
    }
    expect(isPaidParking(now, PAID_HOURS)).toBe(true);
  });

  /**
   * The rule itself, asserted directly.
   *
   * This always passes and exists so that a reader who does not want to reason
   * about "what time is it in UTC right now" can still see what the schedule is.
   */
  it("the_schedule_is_free_on_sundays_and_outside_working_hours", () => {
    const sundayNoon = new Date(Date.UTC(2026, 7, 2, 12, 0, 0));
    const mondayNoon = new Date(Date.UTC(2026, 7, 3, 12, 0, 0));
    const mondayNight = new Date(Date.UTC(2026, 7, 3, 22, 0, 0));

    expect(sundayNoon.getUTCDay()).toBe(0);
    expect(isPaidParking(sundayNoon, PAID_HOURS)).toBe(false);
    expect(isPaidParking(mondayNoon, PAID_HOURS)).toBe(true);
    expect(isPaidParking(mondayNight, PAID_HOURS)).toBe(false);
  });
});
