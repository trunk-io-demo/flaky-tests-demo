import { describe, expect, it } from "vitest";

import {
  balanceFor,
  isFreeDay,
  isPaidParking,
  isSweeping,
  MEMBERS,
  PAID,
  SWEEPING,
  when,
} from "../src/schedule";

// Three gates in order, so a failure names which one it hit: sweeping closes the
// kerb outright, Sunday is free, and the rest is paid and comes down to coins.
//
// Five drivers with balances of 1–5 and costs of 2–6, so during paid hours they
// fail at 20%, 40%, 60%, 80% and 100% — five distinguishable rates from one rule,
// and enough members to watch grouping behave at a small scale.

describe("paid-parking", () => {
  it("the kerb is not being swept right now", () => {
    if (isSweeping()) {
      throw new Error(
        `deliberate failure: street sweeping at ${when()} UTC. No parking on ` +
          `Wednesdays ${String(SWEEPING.fromHour)}:00–${String(SWEEPING.untilHour)}:00 ` +
          `whatever the balance. The demo is working.`,
      );
    }
    expect(isSweeping()).toBe(false);
  });

  it.each(MEMBERS.map(({ member, cost }) => [member, cost] as const))(
    "driver %s can afford the %i coin meter",
    (member, cost) => {
      const balance = balanceFor(member);
      console.log(
        `driver ${member}: ${String(balance)} coins, meter costs ${String(cost)}, ` +
          `${when()} UTC`,
      );

      if (isSweeping()) {
        throw new Error(
          `deliberate failure: driver ${member} cannot park at ${when()} UTC — ` +
            `sweeping closes the kerb on Wednesdays ${String(SWEEPING.fromHour)}:00–` +
            `${String(SWEEPING.untilHour)}:00 regardless of the ${String(balance)} ` +
            `coins in hand. The demo is working.`,
        );
      }

      if (isFreeDay()) {
        console.log(`driver ${member}: Sunday, parking is free`);
        expect(isFreeDay()).toBe(true);
        return;
      }

      if (!isPaidParking()) {
        console.log(
          `driver ${member}: outside paid hours ${String(PAID.fromHour)}:00–` +
            `${String(PAID.untilHour)}:00, nothing to pay`,
        );
        expect(isPaidParking()).toBe(false);
        return;
      }

      if (balance < cost) {
        throw new Error(
          `deliberate failure: driver ${member} has ${String(balance)} coins and the ` +
            `meter wants ${String(cost)} at ${when()} UTC. Balances are 1–5, so this ` +
            `driver is short during ${String((cost - 1) * 20)}% of paid hours. ` +
            `The demo is working.`,
        );
      }
      expect(balance).toBeGreaterThanOrEqual(cost);
    },
  );
});
