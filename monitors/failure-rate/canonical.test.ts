import {
  hourBucket,
  randomPercentage,
  ratePercent,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

/**
 * These three tests differ in exactly one thing: the percentage. Set a
 * threshold anywhere between two of them and you can see which side each lands
 * on. Rates are in README.md, not in the names — a name with a number in it
 * starts lying the first time somebody tunes the demo.
 */

const RATES = {
  low: ratePercent("MONITORS_FAILURE_RATE_LOW", 8),
  medium: ratePercent("MONITORS_FAILURE_RATE_MEDIUM", 30),
  high: ratePercent("MONITORS_FAILURE_RATE_HIGH", 65),
} as const;

describe("failure-rate", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("fails on a low rate", () => {
    expectAtRate("fails on a low rate", RATES.low);
  });

  it("fails on a medium rate", () => {
    expectAtRate("fails on a medium rate", RATES.medium);
  });

  it("fails on a high rate", () => {
    expectAtRate("fails on a high rate", RATES.high);
  });
});

/** The message carries the rate and bucket so a failure can be reproduced. */
function expectAtRate(testName: string, percent: number): void {
  const bucket = hourBucket();
  if (randomPercentage(testName, bucket) < percent) {
    throw new Error(
      `deliberate failure: ${testName} fails ${String(percent)}% of runs ` +
        `(bucket ${bucket}). This is the demo working, not a broken test.`,
    );
  }
  expect(percent).toBeGreaterThanOrEqual(0);
}
