import { describe, expect, it } from "vitest";

import { isEventDay, nextEventDay, triggerDayOfMonth } from "./trigger";

/**
 * ⚠️ **Twenty tests here fail on day 13 of every month, UTC.** Also recorded in
 * README.md and CONTRIBUTING.md, because a whole suite failing at once is
 * indistinguishable from a real incident and somebody paged at 03:00 needs one
 * lookup.
 *
 * This is the only scenario exercising alert *volume* and grouping rather than
 * single detections. Twenty failures in one run for one reason is what a bad
 * deploy looks like, and a per-test rate cannot express "these are one problem".
 */

const SUITE_SIZE = 20;
const TRIGGER_DAY = triggerDayOfMonth();

/** Plausible names, so the burst reads like a subsystem failing rather than a
 * loop with an index. */
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
  /** Passes on the event day too, so it is the only green thing in the folder
   * that day — the fastest way to tell a mass detection from a dead suite. */
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  /** A test rather than only a comment, so the trigger is in the run history
   * where somebody looking at the failing suite is already looking. */
  it("the next mass detection event is announced here", () => {
    const next = nextEventDay(new Date(), TRIGGER_DAY);
    console.log(
      `mass-detection fires on day ${String(TRIGGER_DAY)} of each month; ` +
        `next occurrence ${next.toISOString().slice(0, 10)}`,
    );
    expect(next.getUTCDate()).toBe(TRIGGER_DAY);
  });

  for (const operation of OPERATIONS.slice(0, SUITE_SIZE)) {
    it(operation, () => {
      const now = new Date();
      if (isEventDay(now, TRIGGER_DAY)) {
        throw new Error(
          `deliberate failure: mass detection event. All ${String(SUITE_SIZE)} tests in ` +
            `this suite fail on day ${String(TRIGGER_DAY)} of each month (today is ` +
            `${now.toISOString().slice(0, 10)}). See apps/mass-detection/README.md.`,
        );
      }
      expect(isEventDay(now, TRIGGER_DAY)).toBe(false);
    });
  }
});
