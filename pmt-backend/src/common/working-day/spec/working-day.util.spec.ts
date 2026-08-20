import { Weekday } from '@prisma/client';

import {
  computeWorkingDaysByMember,
  countWorkingDaysInRange,
  endOfRangeExclusive,
  toDateOnly,
} from '../working-day.util';
import { WEEKDAY_TO_DAY_INDEX } from '../working-day.constants';

const FRIDAY_INDEX = WEEKDAY_TO_DAY_INDEX[Weekday.FRIDAY];
const SATURDAY_INDEX = WEEKDAY_TO_DAY_INDEX[Weekday.SATURDAY];

describe('toDateOnly', () => {
  it('drops the time of day, keeping only the UTC calendar date', () => {
    expect(toDateOnly(new Date('2026-08-19T23:59:00.000Z'))).toEqual(
      new Date('2026-08-19T00:00:00.000Z'),
    );
  });
});

describe('endOfRangeExclusive', () => {
  it('is midnight the day after endDate', () => {
    expect(endOfRangeExclusive(new Date('2026-08-19T15:00:00.000Z'))).toEqual(
      new Date('2026-08-20T00:00:00.000Z'),
    );
  });
});

describe('countWorkingDaysInRange', () => {
  // 2026-08-16 is a Sunday, so this full week contains exactly one Friday
  // (08-21) and one Saturday (08-22).
  const weekStart = new Date('2026-08-16T00:00:00.000Z');
  const weekEnd = new Date('2026-08-22T00:00:00.000Z');

  it('excludes the given weekly off day, and nothing else, for a Friday-off week', () => {
    expect(countWorkingDaysInRange(weekStart, weekEnd, [], FRIDAY_INDEX)).toBe(
      6,
    );
  });

  it('excludes Saturday instead, for a Saturday-off week over the SAME range', () => {
    // The same seven calendar days, a different person's count: this is the
    // exact case that broke when the off day was a single company constant.
    expect(
      countWorkingDaysInRange(weekStart, weekEnd, [], SATURDAY_INDEX),
    ).toBe(6);
  });

  it('does not double count when the off day and a holiday land on the same date', () => {
    const holidays = [
      { startDate: new Date('2026-08-21'), endDate: new Date('2026-08-21') },
    ];
    // Friday (08-21) is both the off day and a holiday here. If the two
    // exclusions stacked, this week would read 5, not 6.
    expect(
      countWorkingDaysInRange(weekStart, weekEnd, holidays, FRIDAY_INDEX),
    ).toBe(6);
  });

  it('excludes every day inside a multi day holiday range', () => {
    const holidays = [
      { startDate: new Date('2026-08-17'), endDate: new Date('2026-08-19') },
    ];
    expect(
      countWorkingDaysInRange(weekStart, weekEnd, holidays, FRIDAY_INDEX),
    ).toBe(3);
  });

  it('is 0 for a range that is entirely the off day and holidays', () => {
    const singleDay = new Date('2026-08-21T00:00:00.000Z'); // a Friday
    expect(
      countWorkingDaysInRange(singleDay, singleDay, [], FRIDAY_INDEX),
    ).toBe(0);
  });

  it('counts a single non-off, non-holiday day as 1', () => {
    const singleDay = new Date('2026-08-17T00:00:00.000Z'); // a Monday
    expect(
      countWorkingDaysInRange(singleDay, singleDay, [], FRIDAY_INDEX),
    ).toBe(1);
  });
});

describe('computeWorkingDaysByMember', () => {
  const weekStart = new Date('2026-08-16T00:00:00.000Z');
  const weekEnd = new Date('2026-08-22T00:00:00.000Z');

  it('gives every member their own count against their own weeklyOffDay', () => {
    const result = computeWorkingDaysByMember(
      [
        { userId: 'u1', user: { name: 'Ada', weeklyOffDay: Weekday.FRIDAY } },
        {
          userId: 'u2',
          user: { name: 'Bea', weeklyOffDay: Weekday.SATURDAY },
        },
      ],
      weekStart,
      weekEnd,
      [],
    );

    expect(result.byMember).toEqual([
      { userId: 'u1', name: 'Ada', workingDays: 6 },
      { userId: 'u2', name: 'Bea', workingDays: 6 },
    ]);
  });

  it('computes average/min/max across members whose counts actually differ', () => {
    // A holiday that falls on a day neither member has off, so it costs both
    // of them a day, but from different starting counts.
    const holidays = [
      { startDate: new Date('2026-08-18'), endDate: new Date('2026-08-18') },
    ];
    const result = computeWorkingDaysByMember(
      [
        { userId: 'u1', user: { name: 'Ada', weeklyOffDay: Weekday.FRIDAY } },
        {
          userId: 'u2',
          user: { name: 'Bea', weeklyOffDay: Weekday.SATURDAY },
        },
      ],
      weekStart,
      weekEnd,
      holidays,
    );

    expect(result.byMember.map((m) => m.workingDays)).toEqual([5, 5]);
    expect(result.average).toBe(5);
    expect(result.min).toBe(5);
    expect(result.max).toBe(5);
  });

  it('is null across average/min/max, not 0, when nobody is staffed', () => {
    const result = computeWorkingDaysByMember([], weekStart, weekEnd, []);
    expect(result).toEqual({
      average: null,
      min: null,
      max: null,
      byMember: [],
    });
  });

  it('rounds a repeating-decimal average to 2dp', () => {
    // August 2026 has 4 Fridays and 5 Saturdays, so a Friday-off member and a
    // Saturday-off member do NOT tie over a full month even before the
    // holiday: 27 vs 26 working days. The Monday holiday below costs both
    // kinds of member the same extra day, landing on 26/25/25.
    const result = computeWorkingDaysByMember(
      [
        { userId: 'u1', user: { name: 'Ada', weeklyOffDay: Weekday.FRIDAY } },
        {
          userId: 'u2',
          user: { name: 'Bea', weeklyOffDay: Weekday.SATURDAY },
        },
        {
          userId: 'u3',
          user: { name: 'Cy', weeklyOffDay: Weekday.SATURDAY },
        },
      ],
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-31T00:00:00.000Z'),
      [{ startDate: new Date('2026-08-03'), endDate: new Date('2026-08-03') }], // a Monday
    );

    expect(result.byMember.map((m) => m.workingDays)).toEqual([26, 25, 25]);
    // 76 / 3 = 25.3333..., rounded to 2dp rather than left repeating.
    expect(result.average).toBe(25.33);
    expect(result.min).toBe(25);
    expect(result.max).toBe(26);
  });
});
