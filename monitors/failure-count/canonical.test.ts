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
const rateFor = (member: string): number => Number(member) * 10;

describe("failure-count", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("always fails PB", () => {
    expect(branchClass, "fails on every PB run — the demo working").not.toBe(
      "PB",
    );
  });

  for (const member of MEMBERS) {
    it(`sometimes fails PB ${String(rateFor(member))} percent`, () => {
      if (branchClass !== "PB") return;
      expect(
        randomPercentage(`pb-${member}`),
        `fails ${String(rateFor(member))}% of PB runs — the demo working`,
      ).toBeGreaterThanOrEqual(rateFor(member));
    });
  }

  it("always fails PR", () => {
    expect(branchClass, "fails on every PR run — the demo working").not.toBe(
      "PR",
    );
  });

  for (const member of MEMBERS) {
    it(`sometimes fails PR ${String(rateFor(member))} percent`, () => {
      if (branchClass !== "PR") return;
      expect(
        randomPercentage(`pr-${member}`),
        `fails ${String(rateFor(member))}% of PR runs — the demo working`,
      ).toBeGreaterThanOrEqual(rateFor(member));
    });
  }

  it("always fails MQ", () => {
    expect(branchClass, "fails on every MQ run — the demo working").not.toBe(
      "MQ",
    );
  });

  for (const member of MEMBERS) {
    it(`sometimes fails MQ ${String(rateFor(member))} percent`, () => {
      if (branchClass !== "MQ") return;
      expect(
        randomPercentage(`mq-${member}`),
        `fails ${String(rateFor(member))}% of MQ runs — the demo working`,
      ).toBeGreaterThanOrEqual(rateFor(member));
    });
  }

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
