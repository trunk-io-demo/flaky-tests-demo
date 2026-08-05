/**
 * Dates, in UTC.
 *
 * Everything here is UTC deliberately. A local timezone would make a periodic
 * story depend on where the runner is and on daylight saving, turning a clean
 * weekly or daily pattern into an almost-periodic one — the worst of both.
 */

const MS_PER_DAY = 86_400_000;

/** `Date.prototype.getUTCDay` semantics: 0 is Sunday. */
export const MONDAY = 1;

/** Day of the week, 0–6, Sunday first. */
export const getDay = (now: Date = new Date()): number => now.getUTCDay();

/** Day of the month, 1–31. */
export const getDate = (now: Date = new Date()): number => now.getUTCDate();

/**
 * Whole days since the Unix epoch.
 *
 * The anchor for anything that alternates or cycles. Day-of-month parity would
 * double up across a 31-day month boundary; epoch-day parity never does.
 */
export const getEpochDay = (now: Date = new Date()): number =>
  Math.floor(now.getTime() / MS_PER_DAY);

/** True on every other day, alternating without gaps at month boundaries. */
export const isEveryOtherDay = (now: Date = new Date()): boolean =>
  getEpochDay(now) % 2 === 0;
