import { isDayOfMonth, todayIso } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Twenty tests fail on day 13 of every month, UTC. Also in README.md, and logged
// by a passing test below, because a whole suite failing at once is
// indistinguishable from a real incident.
//
// A recurring rule rather than a date: history ages out so a fixed date rots, but
// this story has to stay discoverable. Capped at 28 so it never skips February.

const TRIGGER_DAY = 13;

const OPERATIONS = [
  "creates an order",
  "reads an order",
  "updates an order",
  "cancels an order",
  "lists orders by customer",
  "applies a discount",
  "recalculates tax",
  "reserves inventory",
  "releases inventory",
  "charges a card",
  "refunds a card",
  "issues a receipt",
  "emails a confirmation",
  "schedules a delivery",
  "reschedules a delivery",
  "tracks a shipment",
  "records a return",
  "credits an account",
  "closes an order",
  "archives an order",
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

  for (const operation of OPERATIONS) {
    it(operation, () => {
      if (isDayOfMonth(TRIGGER_DAY)) {
        throw new Error(
          `deliberate failure: mass detection event. All ${String(OPERATIONS.length)} ` +
            `tests in this suite fail on day ${String(TRIGGER_DAY)} of each month ` +
            `(today is ${todayIso()}). See apps/mass-detection/README.md.`,
        );
      }
      expect(isDayOfMonth(TRIGGER_DAY)).toBe(false);
    });
  }
});
