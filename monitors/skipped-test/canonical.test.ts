import { hourBucket, randomPercentage } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// The serial cascade — the canonical case — is in cascade.spec.ts. These are the
// two quieter ways a test stops running without anybody deleting it.

const SOMETIMES_SKIPPED_RATE = 40;

describe("skipped-test", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it.skip("always skipped never deleted", () => {
    expect(1).toBe(1);
  });

  // Usually running, so nobody notices the runs where it was not. Partial
  // history looks maintained, which is worse than none.
  it("sometimes skipped by a runtime condition", (ctx) => {
    const bucket = hourBucket();
    if (
      randomPercentage("sometimes skipped", bucket) < SOMETIMES_SKIPPED_RATE
    ) {
      ctx.skip(
        `deliberately skipped this run (${String(SOMETIMES_SKIPPED_RATE)}% of runs, ` +
          `bucket ${bucket}). This is the demo working.`,
      );
    }
    expect(bucket).toBeTruthy();
  });

  it("never skipped", () => {
    expect(1).toBe(1);
  });
});
