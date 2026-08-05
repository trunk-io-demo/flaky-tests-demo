import { expect, test } from "@playwright/test";

// The canonical skipped-test case. A serial group stops at its first failure, so
// one broken setup step hides five tests' worth of coverage behind it — and those
// five are absent without anyone deciding they should be. Nobody writes test.skip
// on nineteen tests; this is how it actually arrives.

test("healthcheck always passes", () => {
  expect(1).toBe(1);
});

test.describe.serial("cascade", () => {
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
