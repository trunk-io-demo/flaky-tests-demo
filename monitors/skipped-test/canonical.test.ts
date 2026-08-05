import {
  hourBucket,
  randomPercentage,
  ratePercent,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

/**
 * A skipped test looks green. It appears in no failure rate and no failure
 * count, satisfies whoever asked for coverage, and can sit there for a year.
 *
 * The serial cascade — the canonical case — is in cascade.spec.ts. These are the
 * two quieter ways it happens.
 */

const SOMETIMES_SKIPPED_RATE = ratePercent("MONITORS_SKIP_RATE", 40);

describe("skipped-test", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  /** The classic: skipped at authoring time and never revisited. The body still
   * compiles and still passes review. */
  it.skip("always skipped never deleted", () => {
    expect(1).toBe(1);
  });

  /** The harder case. A test guarded by an environment check or a feature flag
   * is usually running, so nobody notices the runs where it was not — partial
   * history looks maintained. */
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

  /** The control. Runs every time, so the contrast is visible. */
  it("never skipped", () => {
    expect(1).toBe(1);
  });
});
