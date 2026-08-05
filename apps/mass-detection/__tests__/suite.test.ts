import {
  isDayOfMonth,
  randomPercentage,
  todayIso,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Twenty tests fail on the 1st and the 15th, UTC — also in README.md, and logged
// below, because a whole suite going flaky at once looks like a real regression.
// Twice a month rather than once so the pattern is obvious in a short history:
// two spikes read as a cycle where one reads as an accident.
//
// Recurring rules rather than dates: history ages out, so a fixed date rots while
// this story has to stay discoverable. Both are under 28, so February is normal.
//
// Each operation also carries its own small everyday rate, so the twenty are
// distinguishable on ordinary days and still fail together on an event day.

const TRIGGER_DAYS = [1, 15] as const;

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
      `mass-detection fires on days ${TRIGGER_DAYS.join(" and ")} of each month, UTC`,
    );
    // Under 28 or the story would skip February.
    expect(Math.max(...TRIGGER_DAYS)).toBeLessThanOrEqual(28);
  });

  // `%s` renders a string raw; `$name` would quote it.
  it.each(OPERATIONS.map(({ name, rate }) => [name, rate] as const))(
    "%s",
    (name, rate) => {
      if (TRIGGER_DAYS.some((day) => isDayOfMonth(day))) {
        throw new Error(
          `Oh no our API is down what do we do why does this keep happening\n\n` +
            `(Deliberate. All ${String(OPERATIONS.length)} tests in this suite fail ` +
            `on days ${TRIGGER_DAYS.join(" and ")} of each month, UTC — today is ` +
            `${todayIso()}. ` +
            `See apps/mass-detection/README.md.)`,
        );
      }
      expect(
        randomPercentage(`mass-detection-${name}`),
        `fails ${String(rate)}% of runs on ordinary days — the demo working`,
      ).toBeGreaterThanOrEqual(rate);
    },
  );
});
