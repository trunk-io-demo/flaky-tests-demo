import { describe, expect, it } from "vitest";

import { isEventDay, nextEventDay, triggerDayOfMonth } from "./trigger";

/**
 * A whole suite that becomes flaky on one day a month.
 *
 * This is the only scenario in the repo that exercises alert **volume** and
 * **grouping** rather than single detections. Every other story produces one or
 * two findings; this one produces twenty at once, which is a different question
 * for the product to answer well: does it group them, does it rate-limit the
 * notifications, and does the on-call person get one page or twenty?
 *
 * ## This will look like an incident
 *
 * Because it is indistinguishable from one. That is the point, and it is also why
 * the trigger is written down in three places: here, in README.md, and in
 * docs/operations.md. Somebody paged at 03:00 has to be able to answer "is this
 * ours?" in one lookup.
 *
 * The rule is **the 13th of every month, UTC**, by default. See trigger.ts for
 * why it is a recurring rule rather than a date.
 */

const SUITE_SIZE = 20;
const TRIGGER_DAY = triggerDayOfMonth();

/** Plausible names, so the burst reads like a real subsystem failing. */
const OPERATIONS = [
  "creates_an_order",
  "reads_an_order",
  "updates_an_order",
  "cancels_an_order",
  "lists_orders_by_customer",
  "applies_a_discount",
  "recalculates_tax",
  "reserves_inventory",
  "releases_inventory",
  "charges_a_card",
  "refunds_a_card",
  "issues_a_receipt",
  "emails_a_confirmation",
  "schedules_a_delivery",
  "reschedules_a_delivery",
  "tracks_a_shipment",
  "records_a_return",
  "credits_an_account",
  "closes_an_order",
  "archives_an_order",
] as const;

describe("mass-detection", () => {
  /**
   * Never fails, including on the event day.
   *
   * On the day this fires it is the only green thing in the folder, which makes
   * it the fastest way to tell a mass detection from the suite having died.
   */
  it("healthcheck_always_passes", () => {
    expect(TRIGGER_DAY).toBeGreaterThan(0);
  });

  /**
   * Always passes, and says when the next event is.
   *
   * Deliberately a test rather than only a comment: it puts the trigger date in
   * the run history itself, where somebody looking at the failing suite in the
   * product will already be looking.
   */
  it("the_next_mass_detection_event_is_announced_here", () => {
    const now = new Date();
    const next = nextEventDay(now, TRIGGER_DAY);
    console.log(
      `mass-detection fires on day ${String(TRIGGER_DAY)} of each month; ` +
        `next occurrence ${next.toISOString().slice(0, 10)}`,
    );
    expect(next.getUTCDate()).toBe(TRIGGER_DAY);
  });

  /**
   * The event: twenty tests that pass every day except one.
   *
   * They fail *together*, on the same run, for the same reason — which is what an
   * infrastructure change or a bad deploy actually looks like, and what a
   * per-test rate cannot express.
   */
  for (const operation of OPERATIONS.slice(0, SUITE_SIZE)) {
    it(operation, () => {
      const now = new Date();
      if (isEventDay(now, TRIGGER_DAY)) {
        throw new Error(
          `deliberate failure: mass detection event. All ${String(SUITE_SIZE)} tests in ` +
            `this suite fail on day ${String(TRIGGER_DAY)} of each month (today is ` +
            `${now.toISOString().slice(0, 10)}). This is the demo working — see ` +
            `apps/mass-detection/README.md and docs/operations.md.`,
        );
      }
      expect(isEventDay(now, TRIGGER_DAY)).toBe(false);
    });
  }
});
