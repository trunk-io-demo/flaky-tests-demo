import { randomPercentage } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Three tests differing in exactly one thing: the percentage. Set a threshold
// anywhere between two of them and you can see which side each lands on.
// randomPercentage is seeded on the name and the current UTC hour, so a run
// differs from the last one and still reproduces exactly in a fork.

const LOW = 8;
const MEDIUM = 30;
const HIGH = 65;

describe("failure-rate", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("fails on a low rate", () => {
    expect(
      randomPercentage("fails on a low rate"),
      `fails ${String(LOW)}% of runs — the demo working`,
    ).toBeGreaterThanOrEqual(LOW);
  });

  it("fails on a medium rate", () => {
    expect(
      randomPercentage("fails on a medium rate"),
      `fails ${String(MEDIUM)}% of runs — the demo working`,
    ).toBeGreaterThanOrEqual(MEDIUM);
  });

  it("fails on a high rate", () => {
    expect(
      randomPercentage("fails on a high rate"),
      `fails ${String(HIGH)}% of runs — the demo working`,
    ).toBeGreaterThanOrEqual(HIGH);
  });
});
