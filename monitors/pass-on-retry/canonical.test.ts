import { randomPercentage } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// The other half of the story: pairs that form across uploads rather than within
// one. The scheduled runs report against the same head commit hour after hour, so
// a test that fails one hour and passes the next has failed and passed on the same
// commit — a pair, assembled from two uploads.
//
// The retry ladder in retry-ladder.spec.ts is the single-upload version.
//
// Low rates on purpose: at 1% the pair is rare and the test looks healthy, which
// is the case pass-on-retry catches and a failure-rate threshold does not.

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
});
