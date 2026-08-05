import { getDay, now } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// A periodic pattern no percentage-based rate can imitate. Averaged over a week
// the story test fails about 42% of runs — a number that looks like ordinary
// flakiness and tells you nothing. Look at *when* and the pattern is obvious.
// The aggregate is not merely less useful here, it is actively misleading.
//
// All UTC: a local timezone would make the pattern depend on daylight saving.

const PAID_FROM_HOUR = 8;
const PAID_UNTIL_HOUR = 18;
const SUNDAY = 0;

const isPaidParking = (): boolean => {
  if (getDay() === SUNDAY) return false;
  const hour = now().hour();
  return hour >= PAID_FROM_HOUR && hour < PAID_UNTIL_HOUR;
};

const when = (): string =>
  `${now().format("dddd HH:mm")} UTC (paid ${String(PAID_FROM_HOUR)}:00–` +
  `${String(PAID_UNTIL_HOUR)}:00 UTC, Mon–Sat)`;

describe("parking-meter", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("parking is free right now", () => {
    if (isPaidParking()) {
      throw new Error(
        `deliberate failure: parking is not free at ${when()}. This is a schedule ` +
          `rather than a rate. The demo is working.`,
      );
    }
    expect(isPaidParking()).toBe(false);
  });

  // The inverse, so exactly one of the pair fails every run: the suite's total
  // failure count is flat while its composition swings on a cycle.
  it("parking costs money right now", () => {
    if (!isPaidParking()) {
      throw new Error(
        `deliberate failure: parking is free at ${when()}. This is the demo working.`,
      );
    }
    expect(isPaidParking()).toBe(true);
  });
});
