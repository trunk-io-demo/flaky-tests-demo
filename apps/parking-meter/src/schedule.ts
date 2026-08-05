import {
  getDate,
  getDay,
  now,
  randomPercentage,
} from "@flaky-tests-demo/monitors-utils";

// All UTC. A local timezone would make every rule here depend on daylight saving.

export const SUNDAY = 0;
export const WEDNESDAY = 3;
export const THURSDAY = 4;
export const SATURDAY = 6;

/** Which occurrence of this weekday the date is: the 15th is the third. */
export const nthWeekdayOfMonth = (): number => Math.ceil(getDate() / 7);

const isNth = (weekday: number, occurrences: readonly number[]): boolean =>
  getDay() === weekday && occurrences.includes(nthWeekdayOfMonth());

const inHours = (fromHour: number, untilHour: number): boolean => {
  const hour = now().hour();
  return hour >= fromHour && hour < untilHour;
};

// --- Signs on the street ---------------------------------------------------

export const STREET_CLEANING = { fromHour: 6, untilHour: 12 } as const;
export const SWEEPING = { fromHour: 9, untilHour: 12 } as const;
export const PAID = { fromHour: 8, untilHour: 18 } as const;

/** 1st and 3rd Wednesday, 2nd and 4th Thursday, 06:00–12:00. */
export const isStreetCleaning = (): boolean =>
  (isNth(WEDNESDAY, [1, 3]) || isNth(THURSDAY, [2, 4])) &&
  inHours(STREET_CLEANING.fromHour, STREET_CLEANING.untilHour);

/** 1st and 2nd Saturday, all day, for a recurring event. */
export const isEventClosure = (): boolean => isNth(SATURDAY, [1, 2]);

export const isNoParking = (): boolean =>
  isStreetCleaning() || isEventClosure();

/** Every Wednesday 09:00–12:00, which overlaps but outlives street cleaning. */
export const isSweeping = (): boolean =>
  getDay() === WEDNESDAY && inHours(SWEEPING.fromHour, SWEEPING.untilHour);

export const isFreeDay = (): boolean => getDay() === SUNDAY;

export const isPaidParking = (): boolean =>
  !isFreeDay() && !isSweeping() && inHours(PAID.fromHour, PAID.untilHour);

// --- Drivers ---------------------------------------------------------------

// Balance is seeded on the member and the hour, so a driver has the same coins
// all hour and a fork sees the same wallet. Costs differ by member so the five
// fail at 20%, 40%, 60%, 80% and 100% of paid hours rather than together.
export const BALANCE_MIN = 1;
export const BALANCE_MAX = 5;

export const MEMBERS = [
  { member: "01", cost: 2 },
  { member: "02", cost: 3 },
  { member: "03", cost: 4 },
  { member: "04", cost: 5 },
  { member: "05", cost: 6 },
] as const;

export const balanceFor = (member: string): number => {
  const span = BALANCE_MAX - BALANCE_MIN + 1;
  const drawn = Math.floor(
    (randomPercentage(`parking-${member}`) / 100) * span,
  );
  return BALANCE_MIN + Math.min(drawn, span - 1);
};

export const when = (): string => now().format("dddd HH:mm");

export const occurrence = (): string => {
  const nth = nthWeekdayOfMonth();
  const suffix = nth === 1 ? "st" : nth === 2 ? "nd" : nth === 3 ? "rd" : "th";
  return `the ${String(nth)}${suffix} ${now().format("dddd")} of the month`;
};
