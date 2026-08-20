const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

// Counts both the start and end date. Jan 1 to Jan 1 is 1 day, not 0.
export function daysBetweenInclusive(startDate: Date, endDate: Date): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
}

// Elapsed minutes between two timestamps. This has distinct semantics from
// daysBetweenInclusive (a whole day, plus one, inclusive), and is used for
// TimeEntry segment durations.
export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE);
}

/**
 * A date-only string as the first instant of that day, UTC.
 *
 * UTC because a timestamp is an absolute moment and the server's timezone must
 * not decide which day it falls on. `new Date('2026-08-01')` is already parsed
 * as UTC midnight by the language spec; this exists so the intent is stated
 * rather than relied upon, and so its partner below has somewhere to live.
 */
export function startOfUtcDay(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * The LAST instant of the named day, so an inclusive range really is inclusive.
 *
 * This is the whole reason the pair exists. A reader asking for "the 31st" means
 * the whole of it, and a naive `lte` on that day's midnight silently drops
 * everything that happened during it: the range looks right, returns data, and
 * is quietly missing a day. Any endpoint taking an inclusive `endDate` needs
 * this, and there were already four slightly different day boundary helpers in
 * this codebase before it.
 */
export function endOfUtcDay(date: string): Date {
  return new Date(`${date.slice(0, 10)}T23:59:59.999Z`);
}
