import { hourBucket, randomPercentage } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Three tests differing in exactly one thing: the percentage. Set a threshold
// anywhere between two of them and you can see which side each lands on.

const LOW = 8;
const MEDIUM = 30;
const HIGH = 65;

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

describe("failure-rate", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("fails on a low rate", () => {
    expectAtRate("fails on a low rate", LOW);
  });

  it("fails on a medium rate", () => {
    expectAtRate("fails on a medium rate", MEDIUM);
  });

  it("fails on a high rate", () => {
    expectAtRate("fails on a high rate", HIGH);
  });
});
