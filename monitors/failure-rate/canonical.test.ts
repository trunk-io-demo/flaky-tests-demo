import {
  getBranchClass,
  getDay,
  now,
  randomPercentage,
  testIter,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// A ladder from 10% to 100% in steps of ten, so a threshold set anywhere lands
// between two named tests and you can read off which side each falls on.
//
// The last three add a second variable: two whose rate halves outside pull
// requests, and one whose rate climbs through the week. Rates are in the names
// because they are constants in this file — nothing outside it can make them lie.

const branchClass = getBranchClass();
const RUNGS = testIter(10).map((member) => ({
  member,
  rate: Number(member) * 10,
}));
const STEPPED = [40, 80].map((prRate) => ({ prRate, elsewhere: prRate / 2 }));
const RATE_BY_WEEKDAY = [10, 20, 30, 40, 50, 60, 70]; // Sunday first.

describe("failure-rate", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it.each(RUNGS)("fails $rate percent", ({ member, rate }) => {
    expect(
      randomPercentage(`rate-${member}`),
      `fails ${String(rate)}% of runs — the demo working`,
    ).toBeGreaterThanOrEqual(rate);
  });

  it.each(STEPPED)(
    "fails $prRate percent on prs and $elsewhere percent elsewhere",
    ({ prRate, elsewhere }) => {
      const rate = branchClass === "PR" ? prRate : elsewhere;
      expect(
        randomPercentage(`stepped-${String(prRate)}`),
        `fails ${String(rate)}% of ${branchClass} runs — the demo working`,
      ).toBeGreaterThanOrEqual(rate);
    },
  );

  it("fails at a rate that climbs through the week", () => {
    const rate = RATE_BY_WEEKDAY[getDay()] ?? 10;

    expect(
      randomPercentage("weekday"),
      `fails ${String(rate)}% of runs on a ${now().format("dddd")} — the demo working`,
    ).toBeGreaterThanOrEqual(rate);
  });
});
