import { daysAgoIso } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// A test is only new once, so this generates one per day over a rolling window,
// named for the day it appeared. Every day a genuinely new test appears and one
// at the far end stops being emitted. The window exceeds the 14-day new-test
// window so the oldest members have graduated while the newest are still in it.
//
// No absolute dates: history ages out, so a fixed date rots and a fork of it is
// born rotten.

const WINDOW_DAYS = 21;

const windowDays = (): string[] =>
  Array.from({ length: WINDOW_DAYS }, (_unused, i) =>
    daysAgoIso(WINDOW_DAYS - 1 - i),
  );

describe("new-test", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("has been here since the beginning", () => {
    expect(windowDays()).toHaveLength(WINDOW_DAYS);
  });

  for (const day of windowDays()) {
    it(`first appeared on ${day}`, () => {
      expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  }
});
