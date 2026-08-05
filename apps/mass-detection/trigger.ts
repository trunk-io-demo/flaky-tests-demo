/**
 * When the whole suite goes flaky at once.
 *
 * ## Why this is a recurring rule and not a date
 *
 * Two constraints pull in opposite directions here.
 *
 * Run history ages out after roughly 60 days, so **every window in this repo is
 * expressed relative to now, never as an absolute date** — a story pinned to a
 * fixed date rots, and a fork of it is born already rotten.
 *
 * But this scenario also has to be *discoverable*. A whole suite going flaky on
 * one day is indistinguishable from a real incident, and this org is one the team
 * alerts on. Somebody woken up at 03:00 needs to be able to answer "is this
 * ours?" in one lookup.
 *
 * A recurring rule satisfies both. "The 13th of every month" is computable from
 * any date, never rots, and is as easy to check against a page date as a single
 * date would be. The day of month is a repository variable, so a fork can move it
 * without editing code.
 */

/** The day of the month on which the suite becomes flaky. */
export const triggerDayOfMonth = (): number => {
  const raw = process.env.APPS_MASS_DETECTION_DAY_OF_MONTH;
  if (raw === undefined || raw.trim() === "") return 13;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 28) {
    console.warn(
      `APPS_MASS_DETECTION_DAY_OF_MONTH="${raw}" is not a day between 1 and 28; using 13`,
    );
    return 13;
  }
  return parsed;
};

/**
 * Capped at 28 on purpose: 29, 30, and 31 do not exist in every month, so a
 * higher value would silently skip February and make the story irregular in a way
 * nobody could triage.
 */
export const MAX_TRIGGER_DAY = 28;

/** Whether the event is live at `at`. */
export const isEventDay = (at: Date, dayOfMonth: number): boolean =>
  at.getUTCDate() === dayOfMonth;

/** The next date the event fires at or after `at`, for log lines and docs. */
export const nextEventDay = (at: Date, dayOfMonth: number): Date => {
  const thisMonth = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), dayOfMonth),
  );
  if (thisMonth.getTime() >= startOfDay(at).getTime()) return thisMonth;
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, dayOfMonth),
  );
};

const startOfDay = (at: Date): Date =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
