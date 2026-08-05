import { hourBucket } from "./date";

// Seeded, not random: a story has to differ between runs to have a rate, and
// reproduce exactly for a fork to tell the same story. Keyed on a caller-supplied
// string plus the current UTC hour.

/** FNV-1a, 32-bit. Must produce the same number in every runtime, forever. */
const stableHash = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

/** mulberry32. */
const seededRandom = (seed: number): number => {
  let state = (seed + 0x6d2b79f5) >>> 0;
  state = Math.imul(state ^ (state >>> 15), state | 1);
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
  return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
};

/** A percentage in [0, 100) for `key`, fixed within the hour. */
export const randomPercentage = (
  key: string,
  bucket: string = hourBucket(),
): number => seededRandom(stableHash(`${key}#${bucket}`)) * 100;
