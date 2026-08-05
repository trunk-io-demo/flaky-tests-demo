import { hourBucket, randomPercentage } from "@flaky-tests-demo/monitors-utils";
import { describe, it } from "vitest";

// Slowness from contention rather than from work. These run concurrently and take
// turns on one real ticket lock over real shared state, so each waits out everyone
// ahead of it and the tail is several times slower than the work it does. Hold
// times are jittered per hour, so the queue costs a different amount every hour and
// a duration drifts for reasons outside the test. See README.md.

const HOLD_STEP_MS = 40;
const POLL_MS = 5;
const GIVE_UP_MS = 10_000;

let nextTicket = 0;
let nowServing = 0;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** 0.5x to 1.5x, fixed within the hour. */
const jitter = (key: string): number =>
  0.5 + randomPercentage(`contention-${key}`, hourBucket()) / 100;

async function waitForTurn(): Promise<number> {
  const ticket = nextTicket++;
  const startedAt = Date.now();

  while (nowServing !== ticket) {
    if (Date.now() - startedAt > GIVE_UP_MS) {
      throw new Error(
        `deliberate failure: waited ${String(GIVE_UP_MS)}ms for the shared fixture and ` +
          `never got it. Contention that never resolves is a deadlock, not slowness.`,
      );
    }
    await sleep(POLL_MS);
  }
  return Date.now() - startedAt;
}

describe("slow-test contention", () => {
  // Each holds for a different span, so no two contribute the same delay.
  for (const position of [1, 2, 3, 4]) {
    const baseHoldMs = position * HOLD_STEP_MS;

    it.concurrent(
      `waits its turn on the shared fixture, holding it about ${String(baseHoldMs)} ms`,
      async ({ expect }) => {
        const waited = await waitForTurn();
        try {
          await sleep(Math.round(baseHoldMs * jitter(String(position))));
        } finally {
          nowServing++;
        }
        expect(waited).toBeGreaterThanOrEqual(0);
      },
    );
  }
});
