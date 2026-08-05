import {
  daysAgoIso,
  randomPercentage,
  testIter,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// A test is only new once, so this generates one per day over a rolling window,
// named for the day it appeared. Every day a genuinely new test appears and one at
// the far end stops being emitted.
//
// Each member fails at a rate that decays with age — newest 15%, oldest 1% — which
// is both realistic and why the monitor exists: a new test has no history to judge
// a rate against. It also keeps the members from being 21 identical tests.

const WINDOW_DAYS = 21;
const NEWEST_RATE = 15;

const rateForAge = (ageInDays: number): number =>
  Math.max(1, NEWEST_RATE - ageInDays);

describe("new-test", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("has been here since the beginning", () => {
    expect(testIter(WINDOW_DAYS)).toHaveLength(WINDOW_DAYS);
  });

  for (let age = WINDOW_DAYS - 1; age >= 0; age--) {
    const day = daysAgoIso(age);
    const rate = rateForAge(age);

    it(`first appeared on ${day}`, () => {
      expect(
        randomPercentage(`new-test-${day}`),
        `fails ${String(rate)}% of runs at ${String(age)} days old — the demo working`,
      ).toBeGreaterThanOrEqual(rate);
    });
  }
});
