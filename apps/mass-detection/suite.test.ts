import {
  isDayOfMonth,
  randomPercentage,
  todayIso,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Twenty tests fail on day 13 of every month, UTC — also in README.md, and logged
// below, because a whole suite going flaky at once looks like a real regression.
//
// A recurring rule rather than a date: history ages out so a fixed date rots, but
// this story has to stay discoverable. Capped at 28 so it never skips February.
//
// Each operation also carries its own small everyday rate, so the twenty are
// distinguishable on ordinary days and still fail together on the event day.

const TRIGGER_DAY = 13;

const OPERATIONS = [
  { name: "creates an order", rate: 1 },
  { name: "reads an order", rate: 2 },
  { name: "updates an order", rate: 3 },
  { name: "cancels an order", rate: 4 },
  { name: "lists orders by customer", rate: 5 },
  { name: "applies a discount", rate: 6 },
  { name: "recalculates tax", rate: 7 },
  { name: "reserves inventory", rate: 8 },
  { name: "releases inventory", rate: 9 },
  { name: "charges a card", rate: 10 },
  { name: "refunds a card", rate: 11 },
  { name: "issues a receipt", rate: 12 },
  { name: "emails a confirmation", rate: 13 },
  { name: "schedules a delivery", rate: 14 },
  { name: "reschedules a delivery", rate: 15 },
  { name: "tracks a shipment", rate: 16 },
  { name: "records a return", rate: 17 },
  { name: "credits an account", rate: 18 },
  { name: "closes an order", rate: 19 },
  { name: "archives an order", rate: 20 },
] as const;

describe("mass-detection", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("the next mass detection event is announced here", () => {
    console.log(
      `mass-detection fires on day ${String(TRIGGER_DAY)} of each month, UTC`,
    );
    expect(TRIGGER_DAY).toBeLessThanOrEqual(28);
  });

  for (const { name, rate } of OPERATIONS) {
    it(name, () => {
      if (isDayOfMonth(TRIGGER_DAY)) {
        throw new Error(
          `deliberate failure: mass detection event. All ${String(OPERATIONS.length)} ` +
            `tests in this suite fail on day ${String(TRIGGER_DAY)} of each month ` +
            `(today is ${todayIso()}). See apps/mass-detection/README.md.`,
        );
      }
      expect(
        randomPercentage(`mass-detection-${name}`),
        `fails ${String(rate)}% of runs on ordinary days — the demo working`,
      ).toBeGreaterThanOrEqual(rate);
    });
  }
});
