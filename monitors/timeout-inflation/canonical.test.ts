import { hourBucket, randomPercentage } from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// A test blocking on something that is not coming waits out its timeout, so its
// failures cluster at the ceiling while its passes are unaffected — a bimodal
// distribution split by outcome. Drawing duration and outcome independently would
// give failures the same distribution as passes, which is exactly what is not
// happening in a real timeout, so durations are pinned per outcome.

const PASS_MS = 150;
const CEILING_MS = 5_000;
const CEILING_JITTER_PERCENT = 3;
const FAILURE_RATE = 20;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

const ceilingForThisRun = (bucket: string): number => {
  const spread = (CEILING_MS * CEILING_JITTER_PERCENT) / 100;
  const offset = (randomPercentage("ceiling-jitter", bucket) / 50 - 1) * spread;
  return Math.max(1, Math.round(CEILING_MS + offset));
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

      const work: Promise<string> = responseArrives
        ? sleep(PASS_MS).then(() => "response")
        : new Promise(() => {
            /* never resolves */
          });

      const response = await awaitWithTimeout(work, ceilingForThisRun(bucket));
      expect(response).toBe("response");
    },
    // Above the ceiling, or vitest pins the duration at its own limit.
    CEILING_MS + 10_000,
  );

  // Same failure rate, returns immediately: the contrast is the story.
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
