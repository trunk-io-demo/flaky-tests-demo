import { describe, expect, it } from "vitest";

import { hourBucket, intFromEnv } from "./flake";

/**
 * The new-test monitor flags tests that have not been around long enough to
 * trust yet.
 *
 * The reason it exists: a test with three runs of history has no meaningful
 * failure rate, so treating it like an established test either cries wolf or
 * hides a genuinely broken new test in the noise. The monitor gives new tests
 * their own window — 14 days by default — before they are judged on the same
 * terms as everything else.
 *
 * Demonstrating that needs a test that is *actually* new, which is awkward:
 * adding one by hand is a commit, and it is only new once. So this file
 * generates one test per day over a rolling window, named for the day it first
 * appeared. Every day a genuinely new test appears here, and one silently stops
 * being emitted at the far end.
 *
 * Note what is NOT here: an absolute date anywhere. Run history ages out, so a
 * story pinned to a fixed date rots, and a fork of it is born rotten. The window
 * is expressed relative to now and the names fall out of it.
 */

/**
 * Days of rolling window.
 *
 * Should exceed the new-test window so that the oldest members here have
 * graduated out of it while the newest are still in — that contrast is the
 * story. 21 against a 14-day window leaves a clear week of graduated tests.
 */
const WINDOW_DAYS = intFromEnv("MONITORS_NEW_TEST_WINDOW_DAYS", 21, 2, 60);

const MS_PER_DAY = 86_400_000;

/** `2026-08-04` -> `2026_08_04`. The date a test first appeared, in its name. */
const dateSlug = (date: Date): string =>
  date.toISOString().slice(0, 10).replaceAll("-", "_");

/**
 * The days currently in the window, oldest first.
 *
 * Derived from today, so a missed run does not shift the schedule and a fork
 * computes the same set.
 */
export const windowDays = (today: Date = new Date()): Date[] => {
  const days: Date[] = [];
  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset--) {
    days.push(new Date(today.getTime() - offset * MS_PER_DAY));
  }
  return days;
};

describe("new-test", () => {
  /** Never fails, and has existed since this folder did. See ../README.md. */
  it("healthcheck_always_passes", () => {
    expect(hourBucket()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
  });

  /**
   * The control: one test that is emphatically not new.
   *
   * Without it, "everything here is new" is indistinguishable from "the monitor
   * flags everything."
   */
  it("has_been_here_since_the_beginning", () => {
    expect(windowDays()).toHaveLength(WINDOW_DAYS);
  });

  /**
   * One test per day in the window. The newest is hours old; the oldest is
   * about to stop being emitted, which is what exercises resolution by absence.
   *
   * These pass. The story is their age, not their outcome — mixing a failure
   * rate in here would make it impossible to tell which monitor fired.
   */
  for (const day of windowDays()) {
    it(`first_appeared_on_${dateSlug(day)}`, () => {
      expect(dateSlug(day)).toMatch(/^\d{4}_\d{2}_\d{2}$/);
    });
  }
});
