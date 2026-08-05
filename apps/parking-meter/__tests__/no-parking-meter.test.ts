import { describe, expect, it } from "vitest";

import {
  isEventClosure,
  isNoParking,
  isStreetCleaning,
  occurrence,
  STREET_CLEANING,
  when,
} from "../src/schedule";

// A calendar, not a rate. Averaged over a month these look like ordinary
// flakiness; look at *when* and the sign on the street is obvious. That is the
// point — the aggregate is not merely less useful here, it actively misleads.
//
// Two rules with different shapes: a six-hour window on four specific weekdays a
// month, and two whole days a month. They overlap only by coincidence, so the
// pair recovers at different times.

describe("no-parking", () => {
  it("parking is allowed right now", () => {
    if (isNoParking()) {
      throw new Error(
        `deliberate failure: no parking at ${when()} UTC — ${occurrence()}. ` +
          `This is a schedule rather than a rate. The demo is working.`,
      );
    }
    expect(isNoParking()).toBe(false);
  });

  it("the street is not being cleaned right now", () => {
    if (isStreetCleaning()) {
      throw new Error(
        `deliberate failure: street cleaning at ${when()} UTC — ${occurrence()}, ` +
          `and cleaning runs ${String(STREET_CLEANING.fromHour)}:00–` +
          `${String(STREET_CLEANING.untilHour)}:00 on the 1st and 3rd Wednesday and ` +
          `the 2nd and 4th Thursday. The demo is working.`,
      );
    }
    expect(isStreetCleaning()).toBe(false);
  });

  it("the street is not closed for the event right now", () => {
    if (isEventClosure()) {
      throw new Error(
        `deliberate failure: the street is closed all day for a recurring event — ` +
          `${occurrence()}, and the event takes the 1st and 2nd Saturday. Unlike ` +
          `cleaning this has no hours, so it stays red for 24 runs. The demo is working.`,
      );
    }
    expect(isEventClosure()).toBe(false);
  });
});
