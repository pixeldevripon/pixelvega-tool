/**
 * Unit tests for the shared day and minute math.
 *
 * daysBetweenInclusive backs the computed `days` field on both Holiday and
 * LeaveRequest responses; minutesBetween backs TimeEntry segment durations.
 * The two have deliberately different semantics (one counts both endpoints,
 * the other measures elapsed time), which is exactly why they are easy to
 * confuse and worth pinning.
 */

import {
  daysBetweenInclusive,
  endOfUtcDay,
  minutesBetween,
  startOfUtcDay,
} from '../date.util';

const d = (iso: string) => new Date(iso);

describe('daysBetweenInclusive', () => {
  it('counts a single day as 1, not 0', () => {
    // The whole point of "inclusive": one day of leave is one day.
    expect(daysBetweenInclusive(d('2026-01-01'), d('2026-01-01'))).toBe(1);
  });

  it('counts two consecutive days as 2', () => {
    expect(daysBetweenInclusive(d('2026-01-01'), d('2026-01-02'))).toBe(2);
  });

  it('counts a full week as 7', () => {
    expect(daysBetweenInclusive(d('2026-01-01'), d('2026-01-07'))).toBe(7);
  });

  it('counts across a month boundary', () => {
    expect(daysBetweenInclusive(d('2026-01-30'), d('2026-02-02'))).toBe(4);
  });

  it('counts across a leap day', () => {
    // 2028 is a leap year: Feb 28, 29, Mar 1.
    expect(daysBetweenInclusive(d('2028-02-28'), d('2028-03-01'))).toBe(3);
  });

  it('counts across a year boundary', () => {
    expect(daysBetweenInclusive(d('2026-12-30'), d('2027-01-02'))).toBe(4);
  });

  it('rounds rather than truncating, so a DST shift does not lose a day', () => {
    // The implementation divides elapsed milliseconds by a fixed day length,
    // so an offset change would otherwise yield 6.96 days and floor to 6.
    expect(
      daysBetweenInclusive(
        d('2026-03-08T00:00:00Z'),
        d('2026-03-14T00:00:00Z'),
      ),
    ).toBe(7);
  });
});

describe('minutesBetween', () => {
  it('measures elapsed minutes, with no inclusive adjustment', () => {
    // Distinct from daysBetweenInclusive: a zero length segment is 0 minutes.
    expect(
      minutesBetween(d('2026-01-01T09:00:00Z'), d('2026-01-01T09:00:00Z')),
    ).toBe(0);
  });

  it('measures a one minute segment', () => {
    expect(
      minutesBetween(d('2026-01-01T09:00:00Z'), d('2026-01-01T09:01:00Z')),
    ).toBe(1);
  });

  it('measures a full working session', () => {
    expect(
      minutesBetween(d('2026-01-01T09:00:00Z'), d('2026-01-01T17:30:00Z')),
    ).toBe(510);
  });

  it('rounds to the nearest minute', () => {
    expect(
      minutesBetween(d('2026-01-01T09:00:00Z'), d('2026-01-01T09:00:29Z')),
    ).toBe(0);
    expect(
      minutesBetween(d('2026-01-01T09:00:00Z'), d('2026-01-01T09:00:31Z')),
    ).toBe(1);
  });

  it('measures across midnight', () => {
    expect(
      minutesBetween(d('2026-01-01T23:30:00Z'), d('2026-01-02T00:30:00Z')),
    ).toBe(60);
  });
});

describe('startOfUtcDay and endOfUtcDay', () => {
  it('starts at the first instant of the day', () => {
    expect(startOfUtcDay('2026-08-01').toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });

  it('ends at the LAST instant of the day, not its midnight', () => {
    // The whole reason the pair exists. A reader asking for "the 31st" means the
    // whole of it, and an `lte` on that day's midnight silently drops
    // everything that happened during it: the range looks right, returns rows,
    // and is quietly missing a day.
    expect(endOfUtcDay('2026-08-31').toISOString()).toBe(
      '2026-08-31T23:59:59.999Z',
    );
  });

  it('makes an inclusive one-day range actually contain that day', () => {
    const start = startOfUtcDay('2026-08-15');
    const end = endOfUtcDay('2026-08-15');
    const midday = new Date('2026-08-15T13:45:00.000Z');

    expect(midday >= start && midday <= end).toBe(true);
  });

  it('excludes the instant after the day ends', () => {
    const end = endOfUtcDay('2026-08-15');
    expect(new Date('2026-08-16T00:00:00.000Z') > end).toBe(true);
  });

  it('ignores a time component on the input', () => {
    // Callers pass an `@IsDateString()` value, which may be a full timestamp.
    // The day is what matters, so the hour it happened to carry is truncated.
    expect(startOfUtcDay('2026-08-01T18:30:00.000Z').toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    );
    expect(endOfUtcDay('2026-08-01T18:30:00.000Z').toISOString()).toBe(
      '2026-08-01T23:59:59.999Z',
    );
  });

  it('is UTC regardless of where the server sits', () => {
    // An audit timestamp is an absolute moment. If the server's timezone
    // decided which day it fell on, the same query would answer differently in
    // two deployments.
    expect(startOfUtcDay('2026-01-01').getUTCHours()).toBe(0);
    expect(endOfUtcDay('2026-12-31').getUTCHours()).toBe(23);
  });
});
