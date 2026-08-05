import {
  getBranchClass,
  getDay,
  isEveryOtherDay,
  MONDAY,
  randomPercentage,
  testIter,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Every run is exactly one of PB, PR, MQ, so exactly one always-fails test and one
// class's rate ladder fire. The count swings with the branch class while no test's
// own rate changes, which is what a rate cannot express.
//
// Member N fails 10N% of runs of its class: 01 at 10%, 02 at 20%, 03 at 30%.

const branchClass = getBranchClass();
const MEMBERS = testIter(3);
const LADDER = MEMBERS.map((member) => ({
  member,
  rate: Number(member) * 10,
}));

describe("failure-count", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("always fails PB", () => {
    expect(branchClass, "fails on every PB run — the demo working").not.toBe(
      "PB",
    );
  });

  it.each(LADDER)("sometimes fails PB $rate percent", ({ member, rate }) => {
    if (branchClass !== "PB") return;
    expect(
      randomPercentage(`pb-${member}`),
      `fails ${String(rate)}% of PB runs — the demo working`,
    ).toBeGreaterThanOrEqual(rate);
  });

  it("always fails PR", () => {
    expect(branchClass, "fails on every PR run — the demo working").not.toBe(
      "PR",
    );
  });

  it.each(LADDER)("sometimes fails PR $rate percent", ({ member, rate }) => {
    if (branchClass !== "PR") return;
    expect(
      randomPercentage(`pr-${member}`),
      `fails ${String(rate)}% of PR runs — the demo working`,
    ).toBeGreaterThanOrEqual(rate);
  });

  it("always fails MQ", () => {
    expect(branchClass, "fails on every MQ run — the demo working").not.toBe(
      "MQ",
    );
  });

  it.each(LADDER)("sometimes fails MQ $rate percent", ({ member, rate }) => {
    if (branchClass !== "MQ") return;
    expect(
      randomPercentage(`mq-${member}`),
      `fails ${String(rate)}% of MQ runs — the demo working`,
    ).toBeGreaterThanOrEqual(rate);
  });

  it("fails on mondays", () => {
    expect(getDay(), "fails every Monday, UTC — the demo working").not.toBe(
      MONDAY,
    );
  });

  it("fails every other day", () => {
    expect(
      isEveryOtherDay(),
      "fails on alternating days, UTC — the demo working",
    ).toBe(false);
  });
});
