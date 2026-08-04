import { describe, expect, it } from "vitest";

import { failsThisRun, hourBucket, intFromEnv, ratePercent } from "./flake";

/**
 * The timeout-inflation monitor finds a test that did not get slower — it only
 * got slower *when it fails*, because it is blocking on a timeout.
 *
 * This is the sharpest story in the repo and the easiest to miss, so it is worth
 * being precise about what the data has to look like.
 *
 * A test waiting on something that is not coming does not fail fast. It waits out
 * its timeout and then fails, which means its failures all take almost exactly
 * the same amount of time: the ceiling. Its passes are unaffected — they still
 * return as soon as the thing arrives.
 *
 * So the signature is a **bimodal duration distribution split by outcome**:
 *
 * ```
 *   passes:   ▁▂▃▂▁                    ~150ms, tight
 *   failures:                   ▁█▁    ~5000ms, pinned at the ceiling
 * ```
 *
 * Every aggregate misses this:
 *
 * - **Mean duration** barely moves while the failure rate is low.
 * - **A slow-test monitor** sees p95 climb and blames the test for getting
 *   slower, which sends someone to profile code that did not change.
 * - **A failure-rate monitor** sees the failures but says nothing about why, and
 *   a 20% failure rate rarely gets prioritized on its own.
 *
 * The inflation is the diagnosis. It says "this is a timeout, go look at what it
 * is waiting for," which is a completely different investigation.
 *
 * Naive randomness will not produce this shape. Drawing a duration from one range
 * and an outcome independently gives failures the same duration distribution as
 * passes — which is precisely the thing that is *not* happening in a real
 * timeout. The durations here are pinned per outcome, with only the jitter drawn.
 */

/** What a healthy pass costs. Tight distribution — this is the fast path. */
const PASS_MS = intFromEnv("MONITORS_TIMEOUT_PASS_MS", 150, 10, 2_000);

/**
 * The ceiling a failing run blocks against.
 *
 * This is real wall clock on every failing run, so it trades demo fidelity
 * against runner minutes. Five seconds is unmistakably bimodal against a 150ms
 * pass and cheap enough to run hourly.
 */
const CEILING_MS = intFromEnv(
  "MONITORS_TIMEOUT_CEILING_MS",
  5_000,
  500,
  30_000,
);

/**
 * Jitter on the ceiling, as a percentage of it.
 *
 * Real timeouts are not perfectly precise; scheduler noise puts them a few
 * percent either side. Zero jitter would make every failure byte-identical,
 * which reads as generated rather than as a timeout.
 */
const CEILING_JITTER_PERCENT = ratePercent(
  "MONITORS_TIMEOUT_JITTER_PERCENT",
  3,
);

/** How often the thing being waited on fails to arrive. */
const FAILURE_RATE = ratePercent("MONITORS_TIMEOUT_FAILURE_RATE", 20);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for a value that may never arrive, giving up at the ceiling.
 *
 * Deliberately written the way the real bug is written — a race between the work
 * and a timer — rather than as "sleep for 5s, then throw". The duration is a
 * *consequence* of the timeout rather than a number chosen to look like one,
 * which is what makes this a demonstration instead of a mock-up.
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

/** A stable fraction in [0, 1) for a bucket, so the jitter is reproducible. */
function stableFraction(bucket: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bucket.length; i++) {
    hash ^= bucket.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 8) / 0x01000000;
}

/** The ceiling for this run, with a little jitter. */
const ceilingForThisRun = (bucket: string): number => {
  const spread = (CEILING_MS * CEILING_JITTER_PERCENT) / 100;
  const offset = (stableFraction(bucket) * 2 - 1) * spread;
  return Math.max(1, Math.round(CEILING_MS + offset));
};

describe("timeout-inflation", () => {
  /** Never fails, never blocks. See ../README.md. */
  it("healthcheck_always_passes", () => {
    expect(hourBucket()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
  });

  /**
   * The story.
   *
   * When the response arrives, this returns in about `PASS_MS`. When it does not,
   * this blocks until the ceiling and then fails. Same test, two completely
   * different durations, split by outcome.
   */
  it(
    "blocks_on_a_timeout_only_when_it_fails",
    async () => {
      const bucket = hourBucket();
      const ceiling = ceilingForThisRun(bucket);
      const responseArrives = !failsThisRun(
        "timeout-inflation",
        FAILURE_RATE,
        bucket,
      );

      // The work either completes quickly or never completes at all — which is
      // what a request to something that has stopped answering looks like.
      const work: Promise<string> = responseArrives
        ? sleep(PASS_MS).then(() => "response")
        : new Promise(() => {
            /* never resolves */
          });

      const response = await awaitWithTimeout(work, ceiling);
      expect(response).toBe("response");
    },
    // The vitest timeout has to sit above the ceiling, or vitest kills the test
    // first and reports *its* timeout instead — pinning the duration at vitest's
    // limit rather than at the one the story is about.
    CEILING_MS + 10_000,
  );

  /**
   * The control: fails without blocking.
   *
   * This is what makes the story legible. Both tests fail at the same rate; only
   * one of them takes the ceiling to do it. Side by side, the inflation is
   * obviously a property of *how* it fails rather than of the failure itself.
   */
  it("fails_fast_when_it_fails", () => {
    const bucket = hourBucket();
    if (failsThisRun("fails-fast-control", FAILURE_RATE, bucket)) {
      throw new Error(
        `deliberate failure: the control fails at the same rate as its neighbour ` +
          `(${String(FAILURE_RATE)}%, bucket ${bucket}) but returns immediately. ` +
          `This is the demo working, not a broken test.`,
      );
    }
    expect(bucket).toBeTruthy();
  });
});
