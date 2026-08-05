import { expect, test } from "@playwright/test";

// A test that failed and then passed on the same commit is the least deniable
// flakiness signal there is. Every attempt is reported, so one upload holds both
// halves of every pair — pairs form only inside a window of a few hours, so a
// ladder spread across hourly runs never completes.

const LADDER = [
  { name: "passes on the second attempt", attemptsNeeded: 2 },
  { name: "passes on the third attempt", attemptsNeeded: 3 },
  { name: "passes on the fourth attempt", attemptsNeeded: 4 },
] as const;

test("passes on the first attempt", () => {
  expect(1).toBe(1);
});

for (const { name, attemptsNeeded } of LADDER) {
  // The empty destructuring pattern is mandatory; without it, zero tests are found.
  // eslint-disable-next-line no-empty-pattern
  test(name, ({}, testInfo) => {
    const attempt = testInfo.retry + 1;

    if (attempt < attemptsNeeded) {
      throw new Error(
        `deliberate failure: attempt ${String(attempt)} of ${String(attemptsNeeded)}. ` +
          `This failure and the eventual success form a pass-on-retry pair on one ` +
          `commit. This is the demo working.`,
      );
    }

    expect(attempt).toBe(attemptsNeeded);
  });
}

test("never passes however many times it is retried", () => {
  throw new Error(
    "deliberate failure: this test fails on every attempt. Retried and still " +
      "failing is not a pass-on-retry pair, and that boundary is the point. " +
      "This is the demo working.",
  );
});
