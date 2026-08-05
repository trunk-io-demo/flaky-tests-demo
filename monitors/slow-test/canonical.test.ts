import {
  getEpochDay,
  hourBucket,
  randomPercentage,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

// Three shapes, because "slow" is three problems: a gradual ramp a threshold on
// today's duration misses, a bimodal spike an average misses, and a flat control
// without which a noisy runner looks like a regression.

const BASE_MS = 150;
const GROWTH_MS_PER_DAY = 120;
const CYCLE_DAYS = 14;
const SPIKE_FACTOR = 8;
const SPIKE_RATE = 10;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Anchored to the epoch day, so it is computable from today alone. */
const cycleDay = (): number => getEpochDay() % CYCLE_DAYS;

describe("slow-test", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("duration is stable", async () => {
    await sleep(BASE_MS);
    expect(BASE_MS).toBeGreaterThan(0);
  });

  // The ramp resets each cycle, which also shows a detection resolving.
  it("duration grows a little each day", async () => {
    const day = cycleDay();
    await sleep(BASE_MS + day * GROWTH_MS_PER_DAY);
    expect(day).toBeLessThan(CYCLE_DAYS);
  });

  it("duration is usually fast but sometimes is not", async () => {
    const bucket = hourBucket();
    const slow = randomPercentage("slow-spike", bucket) < SPIKE_RATE;
    await sleep(slow ? BASE_MS * SPIKE_FACTOR : BASE_MS);
    expect(bucket).toBeTruthy();
  });
});
