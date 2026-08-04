import { describe, expect, it } from "vitest";

import { failsThisRun, hourBucket, ratePercent } from "./flake";

/**
 * The failure-rate monitor watches what fraction of a test's recent runs failed.
 *
 * These three tests differ in exactly one thing: the percentage. Nothing else
 * about them is interesting, and that is the point — set a threshold anywhere
 * between them and you can see precisely which side of it each test lands on.
 *
 * Read the rates from `README.md`; they are repository variables, so the numbers
 * are not in the test names. A name that claimed "10 percent" would start lying
 * the first time someone tuned the demo.
 */

const RATES = {
  low: ratePercent("MONITORS_FAILURE_RATE_LOW", 8),
  medium: ratePercent("MONITORS_FAILURE_RATE_MEDIUM", 30),
  high: ratePercent("MONITORS_FAILURE_RATE_HIGH", 65),
} as const;

describe("failure-rate", () => {
  /**
   * Never fails, ever.
   *
   * Not decoration. Several monitors resolve when a test stops reporting, so
   * "the monitor resolved" and "the suite stopped running" look identical from
   * the outside. This test is how you tell them apart: if it is green, the suite
   * ran, and anything else you see is the story rather than an outage.
   */
  it("healthcheck_always_passes", () => {
    expect(hourBucket()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
  });

  it("fails_on_a_low_rate", () => {
    expectAtRate("fails_on_a_low_rate", RATES.low);
  });

  it("fails_on_a_medium_rate", () => {
    expectAtRate("fails_on_a_medium_rate", RATES.medium);
  });

  it("fails_on_a_high_rate", () => {
    expectAtRate("fails_on_a_high_rate", RATES.high);
  });
});

/**
 * Fail if this run is one of the failing ones.
 *
 * The failure message carries the rate and the bucket, because the first
 * question anyone asks about a synthetic failure is "was that supposed to
 * happen, and can I reproduce it?"
 */
function expectAtRate(testName: string, percent: number): void {
  const bucket = hourBucket();
  if (failsThisRun(testName, percent, bucket)) {
    throw new Error(
      `deliberate failure: ${testName} fails ${String(percent)}% of runs ` +
        `(bucket ${bucket}). This is the demo working, not a broken test.`,
    );
  }
  expect(percent).toBeGreaterThanOrEqual(0);
}
