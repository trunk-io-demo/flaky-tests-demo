import {
  getBranchClass,
  getDay,
  isEveryOtherDay,
  MONDAY,
  randomPercentage,
  testIter,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Every run is exactly one of PB, PR, MQ, so exactly one always-fails group fires.
// The count swings with the branch class while no test's own rate changes, which
// is what a rate cannot express.

const branchClass = getBranchClass();
const PARTIAL_RATE = 10;
const GROUP = testIter(3);

describe("failure-count", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  describe("always fails on a protected branch", () => {
    for (const member of GROUP) {
      it(`protected branch member ${member}`, () => {
        expect(
          branchClass,
          "fails on every PB run — the demo working",
        ).not.toBe("PB");
      });
    }
  });

  describe("always fails on a pull request", () => {
    for (const member of GROUP) {
      it(`pull request member ${member}`, () => {
        expect(
          branchClass,
          "fails on every PR run — the demo working",
        ).not.toBe("PR");
      });
    }
  });

  describe("always fails in the merge queue", () => {
    for (const member of GROUP) {
      it(`merge queue member ${member}`, () => {
        expect(
          branchClass,
          "fails on every MQ run — the demo working",
        ).not.toBe("MQ");
      });
    }
  });

  describe("sometimes fails on a protected branch", () => {
    for (const member of GROUP) {
      it(`protected branch sometimes member ${member}`, () => {
        if (branchClass !== "PB") return;
        expect(
          randomPercentage(`pb-partial-${member}`),
          "fails 10% of PB runs — the demo working",
        ).toBeGreaterThanOrEqual(PARTIAL_RATE);
      });
    }
  });

  describe("sometimes fails on a pull request", () => {
    for (const member of GROUP) {
      it(`pull request sometimes member ${member}`, () => {
        if (branchClass !== "PR") return;
        expect(
          randomPercentage(`pr-partial-${member}`),
          "fails 10% of PR runs — the demo working",
        ).toBeGreaterThanOrEqual(PARTIAL_RATE);
      });
    }
  });

  describe("sometimes fails in the merge queue", () => {
    for (const member of GROUP) {
      it(`merge queue sometimes member ${member}`, () => {
        if (branchClass !== "MQ") return;
        expect(
          randomPercentage(`mq-partial-${member}`),
          "fails 10% of MQ runs — the demo working",
        ).toBeGreaterThanOrEqual(PARTIAL_RATE);
      });
    }
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
