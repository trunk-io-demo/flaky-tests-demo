import {
  getBranchClass,
  getDay,
  isEveryOtherDay,
  MONDAY,
  randomPercentage,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Every run is exactly one of PB, PR, MQ, so exactly one always-on group fires.
// The count swings with the branch class while no test's own rate changes, which
// is what a rate cannot express.

const CLASS = getBranchClass();
const PARTIAL_RATE = 10;
const GROUP_SIZE = 3;

const members = (): string[] =>
  Array.from({ length: GROUP_SIZE }, (_unused, i) =>
    String(i + 1).padStart(2, "0"),
  );

function alwaysOn(expected: string, position: string): void {
  if (CLASS === expected) {
    throw new Error(
      `deliberate failure: member ${position} fails on every ${expected} run ` +
        `(class ${CLASS}). This is the demo working, not a broken test.`,
    );
  }
  expect(CLASS).not.toBe(expected);
}

function sometimesOn(expected: string, position: string, key: string): void {
  if (CLASS !== expected) {
    expect(CLASS).not.toBe(expected);
    return;
  }
  const draw = randomPercentage(key);
  if (draw < PARTIAL_RATE) {
    throw new Error(
      `deliberate failure: member ${position} fails ${String(PARTIAL_RATE)}% of ` +
        `${expected} runs (drew ${draw.toFixed(1)}). This is the demo working.`,
    );
  }
  expect(draw).toBeGreaterThanOrEqual(PARTIAL_RATE);
}

describe("failure-count", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

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

  it("fails on mondays", () => {
    if (getDay() === MONDAY) {
      throw new Error(
        "deliberate failure: this test fails every Monday, UTC, on every run of " +
          "that day. This is the demo working, not a broken test.",
      );
    }
    expect(getDay()).not.toBe(MONDAY);
  });

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
