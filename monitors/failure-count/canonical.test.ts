import {
  getBranch,
  getBranchClass,
  getDay,
  getPrNumber,
  isEveryOtherDay,
  MONDAY,
  randomPercentage,
  ratePercent,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

/**
 * The failure-count monitor counts failures in a window as an absolute number
 * rather than a proportion. A rate cannot tell one test failing half the time
 * from twelve tests each failing half the time; only the second wakes somebody up.
 *
 * So the counts here depend on *where the run came from* — every run is exactly
 * one of `PB`, `PR`, or `MQ`, so exactly one always-on group fires. The total
 * swings by class while no individual test's rate changes, which is precisely
 * what a rate cannot express. The two date-driven tests move it on a calendar
 * instead.
 */

const BRANCH = getBranch();
const BRANCH_CLASS = getBranchClass();
const PR_NUMBER = getPrNumber();

/** The rate for the partial groups. Their whole point is being well under 100. */
const PARTIAL_RATE = ratePercent("MONITORS_FAILURE_COUNT_RATE", 10);

/** How many tests in each group. The count is what the monitor measures. */
const GROUP_SIZE = 3;

const where = (): string =>
  `branch ${BRANCH}, class ${BRANCH_CLASS}` +
  (PR_NUMBER === undefined ? "" : `, PR #${String(PR_NUMBER)}`);

/** Fails whenever the run came from `expected`. */
function alwaysOn(expected: string, position: string): void {
  if (BRANCH_CLASS === expected) {
    throw new Error(
      `deliberate failure: this test fails on every ${expected} run (${where()}). ` +
        `${String(GROUP_SIZE)} tests fail together here, so the count moves with the ` +
        `branch class while each test's rate stays flat. Member ${position}. ` +
        `This is the demo working, not a broken test.`,
    );
  }
  expect(BRANCH_CLASS).not.toBe(expected);
}

/** Fails on `expected` runs, at a rate, so the count is a fraction of the group. */
function sometimesOn(expected: string, position: string, key: string): void {
  if (BRANCH_CLASS !== expected) {
    expect(BRANCH_CLASS).not.toBe(expected);
    return;
  }
  const draw = randomPercentage(key);
  if (draw < PARTIAL_RATE) {
    throw new Error(
      `deliberate failure: fails ${String(PARTIAL_RATE)}% of ${expected} runs ` +
        `(${where()}, drew ${draw.toFixed(1)}). Member ${position}. ` +
        `This is the demo working, not a broken test.`,
    );
  }
  expect(draw).toBeGreaterThanOrEqual(PARTIAL_RATE);
}

describe("failure-count", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  /**
   * Always-on groups. Exactly one of the three fires per run, so the count is
   * unambiguous: three failures, and the branch class says which group.
   */
  describe("always fails on a protected branch", () => {
    for (const position of members()) {
      it(`protected branch member ${position}`, () => {
        alwaysOn("PB", position);
      });
    }
  });

  describe("always fails on a pull request", () => {
    for (const position of members()) {
      it(`pull request member ${position}`, () => {
        alwaysOn("PR", position);
      });
    }
  });

  describe("always fails in the merge queue", () => {
    for (const position of members()) {
      it(`merge queue member ${position}`, () => {
        alwaysOn("MQ", position);
      });
    }
  });

  /**
   * The same three conditions at 10%. Over a day these contribute a small,
   * noisy count on top of the always-on group — the shape that makes a
   * threshold worth tuning rather than obvious.
   */
  describe("sometimes fails on a protected branch", () => {
    for (const position of members()) {
      it(`protected branch sometimes member ${position}`, () => {
        sometimesOn("PB", position, `pb-partial-${position}`);
      });
    }
  });

  describe("sometimes fails on a pull request", () => {
    for (const position of members()) {
      it(`pull request sometimes member ${position}`, () => {
        sometimesOn("PR", position, `pr-partial-${position}`);
      });
    }
  });

  describe("sometimes fails in the merge queue", () => {
    for (const position of members()) {
      it(`merge queue sometimes member ${position}`, () => {
        sometimesOn("MQ", position, `mq-partial-${position}`);
      });
    }
  });

  /**
   * A count on a calendar rather than on a branch. Every run all day fails, then
   * nothing for six days — a weekly spike no rate threshold describes well.
   */
  it("fails on mondays", () => {
    if (getDay() === MONDAY) {
      throw new Error(
        "deliberate failure: this test fails every Monday, UTC, on every run of " +
          "that day. This is the demo working, not a broken test.",
      );
    }
    expect(getDay()).not.toBe(MONDAY);
  });

  /**
   * Alternating days, anchored to the epoch day so it never doubles up across a
   * month boundary the way day-of-month parity would.
   */
  it("fails every other day", () => {
    if (isEveryOtherDay()) {
      throw new Error(
        "deliberate failure: this test fails on alternating days, UTC. " +
          "This is the demo working, not a broken test.",
      );
    }
    expect(isEveryOtherDay()).toBe(false);
  });
});

/** `01`, `02`, `03` — positions, not outcomes, so tuning cannot make them lie. */
function members(): string[] {
  return Array.from({ length: GROUP_SIZE }, (_unused, index) =>
    String(index + 1).padStart(2, "0"),
  );
}
