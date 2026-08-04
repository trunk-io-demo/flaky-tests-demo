import { describe, expect, it } from "vitest";

import { hourBucket, intFromEnv, seededRandom, stableHash } from "./flake";

/**
 * The slow-test monitor detects duration regressions: a test that still passes
 * but takes materially longer than it used to.
 *
 * It matters because slowness is the failure mode nobody files a bug for. A
 * suite does not become unusable in one commit; it gains four seconds a week
 * until somebody stops running it locally.
 *
 * Three shapes below, because "slow" is three different problems:
 */

const MS_PER_DAY = 86_400_000;

/** Baseline duration everything here is measured against. */
const BASE_MS = intFromEnv("MONITORS_SLOW_BASE_MS", 150, 10, 5_000);

/** Milliseconds added per day of the ramp. */
const GROWTH_MS_PER_DAY = intFromEnv("MONITORS_SLOW_GROWTH_MS", 120, 0, 2_000);

/**
 * Length of the ramp before it resets.
 *
 * A ramp that never resets would eventually take minutes per run, and the story
 * only needs to be told once per cycle. Resetting also demonstrates the *other*
 * half of the monitor: a regression that gets fixed should resolve.
 */
const CYCLE_DAYS = intFromEnv("MONITORS_SLOW_CYCLE_DAYS", 14, 2, 60);

/** How much slower the occasional slow run is, as a multiple of the baseline. */
const SPIKE_FACTOR = intFromEnv("MONITORS_SLOW_SPIKE_FACTOR", 8, 2, 50);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Where in the ramp today falls, 0-indexed.
 *
 * Anchored to the day number since the epoch rather than to a start date, so it
 * is computable from today alone. An absolute anchor would rot: run history ages
 * out, and a fork created mid-cycle would disagree with the original about what
 * day of the ramp it is on.
 */
export const cycleDay = (today: Date = new Date()): number =>
  Math.floor(today.getTime() / MS_PER_DAY) % CYCLE_DAYS;

describe("slow-test", () => {
  /** Never fails, never slow. See ../README.md. */
  it("healthcheck_always_passes", () => {
    expect(hourBucket()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
  });

  /**
   * The control. Same work every run, so its duration is flat.
   *
   * Without it, a platform-wide slowdown — a noisy runner, a slower image — is
   * indistinguishable from the regression next door.
   */
  it("duration_is_stable", async () => {
    await sleep(BASE_MS);
    expect(BASE_MS).toBeGreaterThan(0);
  });

  /**
   * The gradual regression: a little slower every day, then fixed.
   *
   * This is the shape a real duration regression has, and the shape a
   * threshold-on-today's-duration approach misses — no single day's increase is
   * remarkable.
   */
  it("duration_grows_a_little_each_day", async () => {
    const day = cycleDay();
    await sleep(BASE_MS + day * GROWTH_MS_PER_DAY);
    expect(day).toBeLessThan(CYCLE_DAYS);
  });

  /**
   * The bimodal one: usually fast, occasionally much slower.
   *
   * Averages hide this completely. The mean barely moves while a tenth of runs
   * take eight times as long, which is the version of "slow" that a developer
   * actually experiences.
   */
  it("duration_is_usually_fast_but_sometimes_is_not", async () => {
    const bucket = hourBucket();
    const draw = seededRandom(stableHash(`slow-spike#${bucket}`))();
    const slow = draw < 0.1;
    await sleep(slow ? BASE_MS * SPIKE_FACTOR : BASE_MS);
    expect(bucket).toBeTruthy();
  });
});
