import { expect, test } from "@playwright/test";

/**
 * The canonical skipped-test case: a serial suite whose first test fails, which
 * causes every test after it to be skipped rather than run.
 *
 * This is how the problem actually arrives in a real suite. Nobody writes
 * `test.skip` on nineteen tests — one setup step breaks and the runner declines
 * to attempt the rest, so a single failure hides an arbitrary amount of coverage
 * behind it. The suite reports one failure and looks almost fine.
 *
 * What makes it worth a monitor: the skipped tests are not merely absent from the
 * results, they are absent *without anyone deciding they should be*. Every run
 * after this one has no data for them, so their history simply stops — and the
 * only thing distinguishing that from a deleted test is that the file still says
 * otherwise.
 *
 * `test.describe.serial` is what produces it: playwright stops a serial group at
 * the first failure and marks the remainder skipped.
 */

/** Runs before the cascade, so a viewer can see the file was collected at all. */
test("healthcheck always passes", () => {
  expect(1).toBe(1);
});

test.describe.serial("cascade", () => {
  /**
   * The one real failure. Everything below it is collateral, which is the point:
   * a failure count of one, and five tests with no result.
   */
  test("the setup step that everything else depends on", () => {
    throw new Error(
      "deliberate failure: this is the only test here that actually fails. " +
        "The five below it are skipped by the runner because a serial group " +
        "stops at its first failure. This is the demo working.",
    );
  });

  for (const step of [
    "reads the seeded fixture",
    "updates the seeded fixture",
    "reindexes after the update",
    "reconciles the audit log",
    "tears the fixture down",
  ]) {
    test(step, () => {
      expect(1).toBe(1);
    });
  }
});
