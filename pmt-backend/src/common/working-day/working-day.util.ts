import { Weekday } from '@prisma/client';
import { WEEKDAY_TO_DAY_INDEX } from '@/common/working-day/working-day.constants';

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
// weeklyOffDayIndex and any day covered by a Holiday row. Pure function,
// holidays are passed in rather than queried here so this stays easy to test
// and reuse.
//
// weeklyOffDayIndex is REQUIRED, deliberately: this used to read a single
// company wide constant, which is exactly the assumption that broke once each
// user could have their own day off. A caller now has to look up whose day
// this count is for, in WEEKDAY_TO_DAY_INDEX terms, rather than silently
// falling back to a default that would be wrong for anyone not on Friday.
export function countWorkingDaysInRange(
  startDate: Date,
  endDate: Date,
  holidays: HolidayRange[],
  weeklyOffDayIndex: number,
): number {
  const cursor = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  let count = 0;

  while (cursor.getTime() <= end.getTime()) {
    const isWeeklyOff = cursor.getUTCDay() === weeklyOffDayIndex;
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

/**
 * Working days over one range, per active member, plus the team's
 * average/min/max across them.
 *
 * Each member's own weeklyOffDay decides their count (D4: this is exactly the
 * kind of figure two clients would compute identically, so neither one
 * should have to). Null across the board when nobody is currently staffed,
 * the same "the question does not apply" null the rest of the reporting
 * module uses for a zero denominator, not a 0 that would claim a measured
 * answer.
 */
export function computeWorkingDaysByMember(
  activeMembers: Array<{
    userId: string;
    user: { name: string; weeklyOffDay: Weekday };
  }>,
  rangeStart: Date,
  rangeEndInclusive: Date,
  holidays: HolidayRange[],
): {
  average: number | null;
  min: number | null;
  max: number | null;
  byMember: Array<{ userId: string; name: string; workingDays: number }>;
} {
  const byMember = activeMembers.map((member) => ({
    userId: member.userId,
    name: member.user.name,
    workingDays: countWorkingDaysInRange(
      rangeStart,
      rangeEndInclusive,
      holidays,
      WEEKDAY_TO_DAY_INDEX[member.user.weeklyOffDay],
    ),
  }));

  if (byMember.length === 0) {
    return { average: null, min: null, max: null, byMember };
  }

  const counts = byMember.map((member) => member.workingDays);
  return {
    average:
      Math.round(
        (counts.reduce((sum, count) => sum + count, 0) / counts.length) * 100,
      ) / 100,
    min: Math.min(...counts),
    max: Math.max(...counts),
    byMember,
  };
}
