import { expect, test } from "@playwright/test";

/**
 * A test that failed and then passed on the same commit is the least deniable
 * flakiness signal there is. Failing on one commit and passing on the next has
 * an ordinary explanation; doing both on the same code has none.
 *
 * Playwright reports every attempt and junit-reporter.ts turns those into rerun
 * elements, so a single upload contains both halves of every pair below. That
 * matters: pairs form only inside a trailing window of a few hours, so a ladder
 * spread across five hourly runs never completes.
 *
 * The distinct commits come from the PR factory, not the schedule — main does
 * not move hourly. See CONTRIBUTING.md.
 */

/**
 * Attempt counts are in these names, unlike the rates elsewhere, because they
 * are properties of the code rather than of configuration.
 */
const LADDER = [
  { name: "passes on the second attempt", attemptsNeeded: 2 },
  { name: "passes on the third attempt", attemptsNeeded: 3 },
  { name: "passes on the fourth attempt", attemptsNeeded: 4 },
] as const;

/** The control. Without it, "everything here pairs" is indistinguishable from
 * "the monitor pairs everything". */
test("passes on the first attempt", () => {
  expect(1).toBe(1);
});

for (const { name, attemptsNeeded } of LADDER) {
  // Playwright reads the first parameter's destructuring pattern to decide which
  // fixtures to build, so the empty pattern is mandatory rather than sloppy.
  // Getting it wrong fails at collection with zero tests found, after which a
  // reporter writes a valid, empty report and nothing looks broken.
  // eslint-disable-next-line no-empty-pattern
  test(name, ({}, testInfo) => {
    const attempt = testInfo.retry + 1;

    if (attempt < attemptsNeeded) {
      throw new Error(
        `deliberate failure: attempt ${String(attempt)} of ${String(attemptsNeeded)}. ` +
          `Every attempt is reported, so this failure and the eventual success form a ` +
          `pass-on-retry pair on one commit. This is the demo working.`,
      );
    }

    expect(attempt).toBe(attemptsNeeded);
  });
}

/**
 * Retried and still red is not a pass-on-retry pair, and this test makes that
 * boundary visible. Without it a viewer could conclude the monitor flags
 * anything that gets retried.
 */
test("never passes however many times it is retried", () => {
  throw new Error(
    "deliberate failure: this test fails on every attempt. Retried and still " +
      "failing is not a pass-on-retry pair, and that boundary is the point. " +
      "This is the demo working.",
  );
});
