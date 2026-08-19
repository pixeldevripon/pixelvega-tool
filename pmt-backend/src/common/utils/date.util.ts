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
