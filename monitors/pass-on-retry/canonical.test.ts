import { randomPercentage } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Pairs that form across uploads rather than within one: scheduled runs report
// against the same head commit hour after hour, so a test that fails one hour and
// passes the next has done both on one commit. retry-ladder.spec.ts is the
// single-upload version. A ladder of 1%, 10%, 25%: at 1% the test looks healthy by
// any rate measure and the pair is the only thing that says otherwise, while 25%
// pairs often enough to have one to point at.

let attempts = 0;

describe("pass-on-retry", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("fails 1 percent, pairing across uploads", () => {
    expect(
      randomPercentage("pair-across-uploads-1"),
      "fails 1% of runs; the pass and the failure share a commit — the demo working",
    ).toBeGreaterThanOrEqual(1);
  });

  it("fails 10 percent, pairing across uploads", () => {
    expect(
      randomPercentage("pair-across-uploads-10"),
      "fails 10% of runs; the pass and the failure share a commit — the demo working",
    ).toBeGreaterThanOrEqual(10);
  });

  it("fails 25 percent, pairing across uploads", () => {
    expect(
      randomPercentage("pair-across-uploads-25"),
      "fails 25% of runs; the pass and the failure share a commit — the demo working",
    ).toBeGreaterThanOrEqual(25);
  });

  // Deliberately indistinguishable from the healthcheck in the report, which is
  // the whole finding. Leave it that way.
  it(
    "retried twice by vitest and reported as a plain pass",
    { retry: 2 },
    () => {
      attempts++;
      expect(
        attempts,
        "vitest retried this until it passed but reports only the final result, so the " +
          "two failures never reach the product and no pair can form — which is why the " +
          "ladder next door is a playwright story",
      ).toBe(3);
    },
  );
});
