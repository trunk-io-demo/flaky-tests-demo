import { intFromEnv } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

/**
 * A test is only new once, and adding one by hand is a commit — so this
 * generates one per day over a rolling window, named for the day it appeared.
 * Every day a genuinely new test appears and one at the far end stops being
 * emitted.
 *
 * No absolute dates anywhere: history ages out, so a story pinned to a fixed
 * date rots and a fork of it is born rotten.
 */

const WINDOW_DAYS = intFromEnv("MONITORS_NEW_TEST_WINDOW_DAYS", 21, 2, 60);
const MS_PER_DAY = 86_400_000;

const dateSlug = (date: Date): string => date.toISOString().slice(0, 10);

/** The days currently in the window, oldest first. */
export const windowDays = (today: Date = new Date()): Date[] => {
  const days: Date[] = [];
  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset--) {
    days.push(new Date(today.getTime() - offset * MS_PER_DAY));
  }
  return days;
};

describe("new-test", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  /** The control. Without it, "everything here is new" is indistinguishable
   * from "the monitor flags everything". */
  it("has been here since the beginning", () => {
    expect(windowDays()).toHaveLength(WINDOW_DAYS);
  });

  /** These pass. The story is their age, not their outcome — a failure rate
   * mixed in would make it impossible to tell which monitor fired. */
  for (const day of windowDays()) {
    it(`first appeared on ${dateSlug(day)}`, () => {
      expect(dateSlug(day)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  }
});
