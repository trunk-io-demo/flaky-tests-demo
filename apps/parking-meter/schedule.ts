/**
 * When parking costs money.
 *
 * The rule is the one every city has, and the one every parking app gets wrong:
 * paid on weekdays and Saturday between two hours, free on Sunday and free
 * outside those hours.
 *
 * It is a *schedule*, not a probability, which is the whole point of this
 * scenario — see README.md.
 */

/** Hours, UTC, during which parking is paid. Start inclusive, end exclusive. */
export interface PaidWindow {
  readonly startHour: number;
  readonly endHour: number;
}

/** `0` is Sunday, matching `Date.prototype.getUTCDay`. */
export const FREE_DAY = 0;

export const parseWindow = (
  raw: string | undefined,
  fallback: PaidWindow,
): PaidWindow => {
  if (raw === undefined || raw.trim() === "") return fallback;

  const parts = raw.split("-").map((part) => Number.parseInt(part.trim(), 10));
  const [startHour, endHour] = parts;
  const valid =
    parts.length === 2 &&
    startHour !== undefined &&
    endHour !== undefined &&
    Number.isInteger(startHour) &&
    Number.isInteger(endHour) &&
    startHour >= 0 &&
    endHour <= 24 &&
    startHour < endHour;

  if (!valid) {
    console.warn(
      `APPS_PARKING_PAID_HOURS="${raw}" is not a "START-END" hour range; using ` +
        `${String(fallback.startHour)}-${String(fallback.endHour)}`,
    );
    return fallback;
  }
  return { startHour, endHour };
};

/** Whether parking costs money at `at`. */
export const isPaidParking = (at: Date, window: PaidWindow): boolean => {
  if (at.getUTCDay() === FREE_DAY) return false;
  const hour = at.getUTCHours();
  return hour >= window.startHour && hour < window.endHour;
};

/**
 * A human-readable description of `at`, for failure messages.
 *
 * The first question about a periodic failure is "is this the pattern or is it
 * broken?", and the answer is the timestamp plus the rule.
 */
export const describe = (at: Date, window: PaidWindow): string => {
  const day = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][at.getUTCDay()];
  return (
    `${day ?? "?"} ${String(at.getUTCHours()).padStart(2, "0")}:` +
    `${String(at.getUTCMinutes()).padStart(2, "0")} UTC ` +
    `(paid ${String(window.startHour)}:00–${String(window.endHour)}:00 UTC, Mon–Sat)`
  );
};
