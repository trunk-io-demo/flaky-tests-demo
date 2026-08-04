import { describe, expect, it } from "vitest";

import { failsThisRun, hourBucket, ratePercent } from "./flake";

/**
 * The skipped-test monitor detects tests that have stopped running without
 * anybody deleting them.
 *
 * This is the quietest real problem in a test suite. A skipped test looks green.
 * It shows up in no failure rate and no failure count, it satisfies whoever
 * asked for coverage, and it can sit there for a year — usually with a comment
 * saying it will be re-enabled next sprint.
 *
 * The three tests below are the three ways it happens.
 */

const SOMETIMES_SKIPPED_RATE = ratePercent("MONITORS_SKIP_RATE", 40);

describe("skipped-test", () => {
  /** Never fails and never skips. See ../README.md. */
  it("healthcheck_always_passes", () => {
    expect(hourBucket()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
  });

  /**
   * The classic: skipped at authoring time and never revisited.
   *
   * `it.skip` is what a real one looks like — the body is still here, still
   * compiles, still passes review, and has not executed since the day someone
   * put four characters in front of it.
   */
  it.skip("always_skipped_never_deleted", () => {
    expect("this body has not run in a very long time").toBeTruthy();
  });

  /**
   * The harder one: skipped only sometimes, by a runtime condition.
   *
   * A test guarded by an environment check, a feature flag, or a platform test
   * is *usually* running, so nobody notices the runs where it did not. It has
   * partial history, which is worse than none — it looks maintained.
   */
  it("sometimes_skipped_by_a_runtime_condition", (ctx) => {
    const bucket = hourBucket();
    if (failsThisRun("sometimes_skipped", SOMETIMES_SKIPPED_RATE, bucket)) {
      ctx.skip(
        `deliberately skipped this run (${String(SOMETIMES_SKIPPED_RATE)}% of runs, ` +
          `bucket ${bucket}). This is the demo working.`,
      );
    }
    expect(bucket).toBeTruthy();
  });

  /** The control. Runs every time, so the contrast is visible. */
  it("never_skipped", () => {
    expect(new Date().getUTCFullYear()).toBeGreaterThan(2000);
  });
});
