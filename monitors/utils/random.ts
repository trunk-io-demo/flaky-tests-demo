/**
 * Seeded randomness, and reading numbers out of the environment.
 *
 * Three things have to be true at once and they pull against each other: the
 * rate is tunable from a repository variable, the outcome differs between runs,
 * and the outcome is reproducible so a fork tells the same story.
 *
 * `Math.random()` gives up the third. A fixed outcome gives up the second. So
 * the seed is derived from a caller-supplied key and the current UTC hour.
 */

/** The seed bucket: one per UTC hour. */
export const hourBucket = (now: Date = new Date()): string =>
  now.toISOString().slice(0, 13);

/**
 * FNV-1a, 32-bit.
 *
 * Has to produce the same number in every JavaScript runtime forever, because
 * changing it reseeds every story in this directory.
 */
export const stableHash = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

/** mulberry32: small and fully specified. */
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
 * A percentage in [0, 100) for `key`, fixed within the hour and different the
 * next hour. Compare against a rate: `randomPercentage(name) < 10`.
 */
export const randomPercentage = (
  key: string,
  bucket: string = hourBucket(),
): number => seededRandom(stableHash(`${key}#${bucket}`))() * 100;

/**
 * A bounded integer from the environment.
 *
 * Falls back rather than throwing: a typo in a variable should show up as the
 * demo being quieter than expected, not as a red run that looks like a real
 * breakage.
 */
export const intFromEnv = (
  variable: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  const raw = process.env[variable];
  if (raw === undefined || raw.trim() === "") return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    console.warn(
      `${variable}="${raw}" is not an integer between ${String(min)} and ${String(max)}; ` +
        `using ${String(fallback)}`,
    );
    return fallback;
  }
  return parsed;
};

/** A percentage from the environment. */
export const ratePercent = (variable: string, fallback: number): number =>
  intFromEnv(variable, fallback, 0, 100);
