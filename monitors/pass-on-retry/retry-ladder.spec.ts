import { expect, test } from "@playwright/test";

/**
 * The pass-on-retry monitor finds a test that failed and then passed **on the
 * same commit**.
 *
 * That pairing is what makes it the least deniable flakiness signal there is. A
 * test that fails on one commit and passes on the next has an ordinary
 * explanation: somebody fixed something. A test that does both on the same code
 * has none. Nothing changed, so the test is not measuring what it claims to.
 *
 * ## Why this is a playwright story and not a vitest one
 *
 * Pass-on-retry pairs are only formed from runs inside a trailing window of a few
 * hours, and the pair threshold counts *distinct commits*. So a ladder of five
 * pairs cannot be spread across five hourly runs spanning ten hours — the
 * earliest pairs age out before the fifth lands.
 *
 * The story has to complete inside one window, ideally inside one run. Playwright
 * gives that for free: it reports every attempt, and the JUnit parser expands
 * those into separate run rows, so a **single upload** contains both halves of
 * every pair below. No two-workflow retry dance, no cross-run bookkeeping,
 * nothing to age out.
 *
 * ## Where the distinct commits come from
 *
 * Scheduled runs all report against the same head commit — `main` does not move
 * hourly — so the schedule alone supplies one distinct commit no matter how often
 * it runs. The PR factory is what supplies fresh ones: it opens a pull request
 * every hour, each with its own commit, and `pr.yaml` runs this ladder against
 * it. If pass-on-retry detections are not appearing, the factory's token is the
 * first thing to check. See `docs/operations.md`.
 */

/**
 * The ladder. Each test needs a different number of attempts to pass, which is
 * what a real flaky test's retry behavior looks like in aggregate: some settle
 * immediately, some take several goes.
 *
 * The attempt count is in the name because it is a property of the test's code,
 * not of configuration — unlike the rates elsewhere in this repo, tuning does not
 * make these names lie.
 */
const LADDER = [
  { name: "passes_on_the_second_attempt", attemptsNeeded: 2 },
  { name: "passes_on_the_third_attempt", attemptsNeeded: 3 },
  { name: "passes_on_the_fourth_attempt", attemptsNeeded: 4 },
] as const;

/**
 * Passes on the first attempt, every time.
 *
 * The control. Without it, "everything in this folder pairs" is
 * indistinguishable from "the monitor pairs everything," and a viewer cannot
 * tell whether retrying is what made the difference.
 */
test("passes_on_the_first_attempt", () => {
  expect(1).toBe(1);
});

for (const { name, attemptsNeeded } of LADDER) {
  // Playwright rejects a first parameter that is not an object destructuring
  // pattern — it reads the pattern to decide which fixtures to build — so the
  // empty pattern is mandatory here rather than sloppy. No fixtures are needed:
  // this ladder is about the runner's retry behavior, not about a page.
  //
  // Getting this wrong fails at collection time with zero tests found, and a
  // reporter then writes a valid, empty report. Nothing looks broken.
  // eslint-disable-next-line no-empty-pattern
  test(name, ({}, testInfo) => {
    // `testInfo.retry` is 0 on the first attempt, so attempt number is retry + 1.
    const attempt = testInfo.retry + 1;

    if (attempt < attemptsNeeded) {
      throw new Error(
        `deliberate failure: attempt ${String(attempt)} of ${String(attemptsNeeded)}. ` +
          `This test passes on attempt ${String(attemptsNeeded)} and every attempt is ` +
          `reported, so this failure and the eventual success form a pass-on-retry pair ` +
          `on one commit. This is the demo working, not a broken test.`,
      );
    }

    expect(attempt).toBe(attemptsNeeded);
  });
}

/**
 * Fails on every attempt and never passes.
 *
 * Retried and still red is *not* a pass-on-retry pair, and this test is here to
 * make that boundary visible. Without it, a viewer could reasonably conclude the
 * monitor flags anything that gets retried — which would make its detections
 * mean much less than they do.
 *
 * It is also the one test in this folder that a `failure-rate` monitor should
 * see at 100% while pass-on-retry ignores it entirely.
 */
test("never_passes_however_many_times_it_is_retried", () => {
  throw new Error(
    "deliberate failure: this test fails on every attempt. Retried and still " +
      "failing is not a pass-on-retry pair, and that boundary is the point of " +
      "this test. This is the demo working.",
  );
});
