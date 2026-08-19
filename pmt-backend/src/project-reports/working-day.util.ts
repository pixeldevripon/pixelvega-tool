import { WEEKLY_OFF_DAY } from './working-day.constants';

interface HolidayRange {
  startDate: Date;
  endDate: Date;
}

// Shared by both report services, not just the working day count below, so
// a requested startDate/endDate string pair always turns into the same
// Date boundaries regardless of which service is filtering with them.
export function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

// Exclusive upper bound, the day after endDate at UTC midnight, so a full
// DateTime column (createdAt, startedAt, resolvedAt, ...) can be filtered
// with gte/lt rather than juggling end of day inclusively.
export function endOfRangeExclusive(endDate: Date): Date {
  const next = toDateOnly(endDate);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

// Counts every calendar day in [startDate, endDate] (both inclusive) except
// the team's weekly off day and any day covered by a Holiday row. Pure
// function, holidays are passed in rather than queried here so this stays
// easy to test and reuse.
export function countWorkingDaysInRange(
  startDate: Date,
  endDate: Date,
  holidays: HolidayRange[],
): number {
  const cursor = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  let count = 0;

  while (cursor.getTime() <= end.getTime()) {
    const isWeeklyOff = cursor.getUTCDay() === WEEKLY_OFF_DAY;
    const isHoliday = holidays.some(
      (holiday) =>
        cursor.getTime() >= toDateOnly(holiday.startDate).getTime() &&
        cursor.getTime() <= toDateOnly(holiday.endDate).getTime(),
    );
    if (!isWeeklyOff && !isHoliday) {
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}
