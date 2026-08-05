import {
  hourBucket,
  intFromEnv,
  randomPercentage,
  ratePercent,
  stableHash,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

/**
 * A test blocking on something that is not coming does not fail fast. It waits
 * out its timeout, so its failures cluster at the ceiling while its passes are
 * unaffected — a bimodal duration distribution split by outcome:
 *
 * ```
 *   passes:   ▁▂▃▂▁                    ~150ms, tight
 *   failures:                   ▁█▁    ~5000ms, at the ceiling
 * ```
 *
 * Naive randomness cannot produce this. Drawing duration and outcome
 * independently gives failures the same distribution as passes, which is exactly
 * the thing that is not happening in a real timeout. So durations are pinned per
 * outcome and only the jitter is drawn.
 */

const PASS_MS = intFromEnv("MONITORS_TIMEOUT_PASS_MS", 150, 10, 2_000);
const CEILING_MS = intFromEnv(
  "MONITORS_TIMEOUT_CEILING_MS",
  5_000,
  500,
  30_000,
);
const CEILING_JITTER_PERCENT = ratePercent(
  "MONITORS_TIMEOUT_JITTER_PERCENT",
  3,
);
const FAILURE_RATE = ratePercent("MONITORS_TIMEOUT_FAILURE_RATE", 20);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A race between the work and a timer, which is how the real bug is written.
 * The duration is a consequence of the timeout rather than a number chosen to
 * look like one.
 */
async function awaitWithTimeout<T>(
  work: Promise<T>,
  ceilingMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `timed out after ${String(ceilingMs)}ms waiting for a response`,
              ),
            ),
          ceilingMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** A stable fraction in [0, 1), so the jitter is reproducible. */
const stableFraction = (bucket: string): number =>
  (stableHash(bucket) >>> 8) / 0x01000000;

/** Zero jitter would make every failure byte-identical, which reads as
 * generated rather than as a timeout. */
const ceilingForThisRun = (bucket: string): number => {
  const spread = (CEILING_MS * CEILING_JITTER_PERCENT) / 100;
  return Math.max(
    1,
    Math.round(CEILING_MS + (stableFraction(bucket) * 2 - 1) * spread),
  );
};

describe("timeout-inflation", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it(
    "blocks on a timeout only when it fails",
    async () => {
      const bucket = hourBucket();
      const responseArrives =
        randomPercentage("timeout-inflation", bucket) >= FAILURE_RATE;

      // Either completes quickly or never completes at all — what a request to
      // something that has stopped answering looks like.
      const work: Promise<string> = responseArrives
        ? sleep(PASS_MS).then(() => "response")
        : new Promise(() => {
            /* never resolves */
          });

      const response = await awaitWithTimeout(work, ceilingForThisRun(bucket));
      expect(response).toBe("response");
    },
    // Above the ceiling, or vitest kills the test first and pins the duration at
    // its own limit rather than at the one the story is about.
    CEILING_MS + 10_000,
  );

  /** The control: same failure rate, returns immediately. Side by side, the
   * inflation is obviously a property of how it fails. */
  it("fails fast when it fails", () => {
    const bucket = hourBucket();
    if (randomPercentage("fails-fast-control", bucket) < FAILURE_RATE) {
      throw new Error(
        `deliberate failure: the control fails at the same rate as its neighbour ` +
          `(${String(FAILURE_RATE)}%, bucket ${bucket}) but returns immediately. ` +
          `This is the demo working, not a broken test.`,
      );
    }
    expect(bucket).toBeTruthy();
  });
});
