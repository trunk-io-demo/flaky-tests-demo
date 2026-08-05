import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);

// Everything is UTC. A local timezone would make a periodic story depend on
// daylight saving, turning a clean pattern into an almost-periodic one.
export const now = () => dayjs.utc();

/** 0 is Sunday. */
export const MONDAY = 1;

export const getDay = (): number => now().day();

export const getDate = (): number => now().date();

/** Whole days since the epoch: the anchor for anything that alternates. */
export const getEpochDay = (): number =>
  Math.floor(now().valueOf() / 86_400_000);

/** Alternating days, without doubling up across a month boundary. */
export const isEveryOtherDay = (): boolean => getEpochDay() % 2 === 0;

export const isDayOfMonth = (dayOfMonth: number): boolean =>
  getDate() === dayOfMonth;

export const todayIso = (): string => now().format("YYYY-MM-DD");

export const hourBucket = (): string => now().format("YYYY-MM-DDTHH");

export const daysAgoIso = (days: number): string =>
  now().subtract(days, "day").format("YYYY-MM-DD");
