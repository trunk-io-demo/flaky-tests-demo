import {
  hourBucket,
  intFromEnv,
  randomPercentage,
} from "@flaky-tests-demo/monitors-utils";
import { describe, expect, it } from "vitest";

/**
 * Three shapes, because "slow" is three problems: a gradual ramp that a
 * threshold on today's duration misses, a bimodal spike that an average misses,
 * and a flat control without which a noisy runner looks like a regression.
 */

const MS_PER_DAY = 86_400_000;

const BASE_MS = intFromEnv("MONITORS_SLOW_BASE_MS", 150, 10, 5_000);
const GROWTH_MS_PER_DAY = intFromEnv("MONITORS_SLOW_GROWTH_MS", 120, 0, 2_000);
const CYCLE_DAYS = intFromEnv("MONITORS_SLOW_CYCLE_DAYS", 14, 2, 60);
const SPIKE_FACTOR = intFromEnv("MONITORS_SLOW_SPIKE_FACTOR", 8, 2, 50);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Where in the ramp today falls, anchored to the day number since the epoch so
 * it is computable from today alone. An absolute anchor would rot as history
 * ages out, and a fork created mid-cycle would disagree about the ramp position.
 */
export const cycleDay = (today: Date = new Date()): number =>
  Math.floor(today.getTime() / MS_PER_DAY) % CYCLE_DAYS;

describe("slow-test", () => {
  it("healthcheck always passes", () => {
    expect(1).toBe(1);
  });

  it("duration is stable", async () => {
    await sleep(BASE_MS);
    expect(BASE_MS).toBeGreaterThan(0);
  });

  /** The ramp resets at the end of each cycle, which also demonstrates a
   * detection resolving because something got fixed. */
  it("duration grows a little each day", async () => {
    const day = cycleDay();
    await sleep(BASE_MS + day * GROWTH_MS_PER_DAY);
    expect(day).toBeLessThan(CYCLE_DAYS);
  });

  /** Averages hide this completely: the mean barely moves while a tenth of runs
   * take eight times as long. */
  it("duration is usually fast but sometimes is not", async () => {
    const bucket = hourBucket();
    const slow = randomPercentage("slow-spike", bucket) < 10;
    await sleep(slow ? BASE_MS * SPIKE_FACTOR : BASE_MS);
    expect(bucket).toBeTruthy();
  });
});
