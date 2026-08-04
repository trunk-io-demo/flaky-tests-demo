/**
 * A test outcome that is random-looking, tunable, and reproducible.
 *
 * Three properties matter, and they pull against each other:
 *
 * 1. **Tunable from configuration**, not from editing this file. The rate comes
 *    from a repository variable, so making the demo noisier is a settings change.
 * 2. **Different from run to run**, or there is no rate to observe — just a test
 *    that always passes or always fails.
 * 3. **Reproducible**, so a fork tells the same story as the original and so a
 *    surprising run can be replayed rather than guessed at.
 *
 * `Math.random()` gives up the third. A fixed outcome gives up the second. So
 * the seed is derived from the test's name and the current hour: within one
 * hourly run every test has a fixed, computable outcome, and the next run is a
 * different draw.
 *
 * This file is deliberately duplicated in the monitor packages that need it
 * rather than shared from one place. Each story is meant to be readable on its
 * own, by someone who opened one folder and nothing else — see
 * `docs/architecture.md`.
 */

/** The seed bucket: one per UTC hour. */
export const hourBucket = (now: Date = new Date()): string =>
  now.toISOString().slice(0, 13);

/**
 * FNV-1a, 64-bit, truncated to 32 for the generator below.
 *
 * Not `String.prototype.hashCode`-style arithmetic and not a crypto hash: this
 * has to produce the same number in every JavaScript runtime, forever, because
 * changing it silently reseeds every story in this folder.
 */
export const stableHash = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

/** mulberry32: a small, fully specified generator. */
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Read a percentage from the environment.
 *
 * Falls back rather than throwing: a local `pnpm test` with no repository
 * variables set should still run the story, and a typo in a variable should not
 * take the whole suite down — it should show up as the story not being as noisy
 * as expected, which is visible.
 */
export const ratePercent = (variable: string, fallback: number): number => {
  const raw = process.env[variable];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    console.warn(
      `${variable}="${raw}" is not a percentage between 0 and 100; using ${String(fallback)}`,
    );
    return fallback;
  }
  return parsed;
};

/**
 * Whether this run of `testName` should fail, given a percentage.
 *
 * Deterministic for a given test name and hour, which is what makes the story
 * reproducible: the same fork, replaying the same hour, sees the same outcomes.
 */
export const failsThisRun = (
  testName: string,
  percent: number,
  bucket: string = hourBucket(),
): boolean => {
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  const draw = seededRandom(stableHash(`${testName}#${bucket}`))();
  return draw * 100 < percent;
};
