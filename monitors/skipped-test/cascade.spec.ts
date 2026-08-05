import { hourBucket, randomPercentage } from "@flaky-tests-demo/monitors-utils";
import { expect, test } from "@playwright/test";

// The canonical skipped-test case: a serial group stops at its first failure, so
// one broken setup step hides five tests' worth of coverage behind it — absent
// without anyone deciding they should be. Nobody writes test.skip on nineteen
// tests; this is how it actually arrives.
//
// The setup fails most runs, not all, so the downstream steps have *partial*
// history — mostly skipped, occasionally run. That is the shape the monitor looks
// for, and it gives each step its own rate rather than five identical rows.

const SETUP_FAILURE_RATE = 60;

const STEPS = [
  { name: "reads the seeded fixture", rate: 2 },
  { name: "updates the seeded fixture", rate: 4 },
  { name: "reindexes after the update", rate: 6 },
  { name: "reconciles the audit log", rate: 8 },
  { name: "tears the fixture down", rate: 10 },
] as const;

test("healthcheck always passes", () => {
  expect(1).toBe(1);
});

test.describe.serial("cascade", () => {
  test("the setup step that everything else depends on", () => {
    const bucket = hourBucket();
    expect(
      randomPercentage("cascade-setup", bucket),
      `fails ${String(SETUP_FAILURE_RATE)}% of runs, skipping everything below it — ` +
        `the demo working`,
    ).toBeGreaterThanOrEqual(SETUP_FAILURE_RATE);
  });

  for (const { name, rate } of STEPS) {
    test(name, () => {
      expect(
        randomPercentage(`cascade-${name}`),
        `fails ${String(rate)}% of the runs it is allowed to attempt — the demo working`,
      ).toBeGreaterThanOrEqual(rate);
    });
  }
});
