/**
 * Unit tests for the shared time entry date math.
 *
 * getAutoStopCutoff is the safety net against a forgotten running timer. It is
 * checked lazily rather than by a background job, so if it computes the wrong
 * moment nothing else catches it: the timer simply keeps accruing, or gets cut
 * short, and Project.actualHours is wrong from then on.
 */

import {
  buildStartedAtFilter,
  endOfUtcDay,
  getAutoStopCutoff,
  isPreviousUtcDay,
} from '@/projects/time-entries/time-entry-date.util';
import { MAX_CONTINUOUS_SESSION_MINUTES } from '@/projects/time-entries/time-tracking.constants';

const d = (iso: string) => new Date(iso);

describe('MAX_CONTINUOUS_SESSION_MINUTES', () => {
  it('is nine office hours', () => {
    expect(MAX_CONTINUOUS_SESSION_MINUTES).toBe(540);
  });
});

describe('endOfUtcDay', () => {
  it('returns 23:59:59.999 UTC on the same calendar day', () => {
    expect(endOfUtcDay(d('2026-03-10T08:15:00Z')).toISOString()).toBe(
      '2026-03-10T23:59:59.999Z',
    );
  });

  it('is idempotent when already at the end of the day', () => {
    expect(endOfUtcDay(d('2026-03-10T23:59:59.999Z')).toISOString()).toBe(
      '2026-03-10T23:59:59.999Z',
    );
  });

  it('uses the UTC calendar day, not a local one', () => {
    // 22:00 UTC on the 10th is already the 11th in UTC+6 (Dhaka). The cutoff
    // must still land on the 10th, because the whole app dates by UTC day.
    expect(endOfUtcDay(d('2026-03-10T22:00:00Z')).toISOString()).toBe(
      '2026-03-10T23:59:59.999Z',
    );
  });
});

describe('getAutoStopCutoff', () => {
  it('uses the nine hour cap when it lands before the end of the day', () => {
    // Started 08:00, so the cap hits 17:00, well before midnight.
    expect(getAutoStopCutoff(d('2026-03-10T08:00:00Z')).toISOString()).toBe(
      '2026-03-10T17:00:00.000Z',
    );
  });

  it('uses the end of the UTC day when the cap would run past midnight', () => {
    // Started 20:00, so nine hours would reach 05:00 the NEXT day. A segment
    // must not straddle a UTC calendar day, so the day boundary wins.
    expect(getAutoStopCutoff(d('2026-03-10T20:00:00Z')).toISOString()).toBe(
      '2026-03-10T23:59:59.999Z',
    );
  });

  it('takes the day boundary at exactly the crossover point', () => {
    // Started 15:00: the cap is 00:00 next day, which is past the boundary.
    const cutoff = getAutoStopCutoff(d('2026-03-10T15:00:00Z'));
    expect(cutoff.toISOString()).toBe('2026-03-10T23:59:59.999Z');
  });

  it('takes the cap just before the crossover point', () => {
    // Started 14:59:59: the cap is 23:59:59, one millisecond inside the day.
    const cutoff = getAutoStopCutoff(d('2026-03-10T14:59:59.000Z'));
    expect(cutoff.toISOString()).toBe('2026-03-10T23:59:59.000Z');
  });

  it('never returns a cutoff on a later calendar day than the start', () => {
    for (const hour of [0, 6, 12, 15, 18, 21, 23]) {
      const startedAt = d(`2026-03-10T${String(hour).padStart(2, '0')}:00:00Z`);
      const cutoff = getAutoStopCutoff(startedAt);
      expect(cutoff.getUTCDate()).toBe(startedAt.getUTCDate());
      expect(cutoff.getTime()).toBeGreaterThan(startedAt.getTime());
    }
  });

  it('caps a segment started just after midnight at nine hours, not at the day end', () => {
    expect(getAutoStopCutoff(d('2026-03-10T00:01:00Z')).toISOString()).toBe(
      '2026-03-10T09:01:00.000Z',
    );
  });

  it('yields a cutoff already in the past for a segment left over from an earlier day', () => {
    // This is what makes the lazy check work: anything from a previous day is
    // always already expired the next time it is touched.
    const cutoff = getAutoStopCutoff(d('2020-01-01T09:00:00Z'));
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });
});

describe('isPreviousUtcDay', () => {
  it('is true for yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isPreviousUtcDay(yesterday)).toBe(true);
  });

  it('is false for right now', () => {
    expect(isPreviousUtcDay(new Date())).toBe(false);
  });

  it('is false for a future date', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isPreviousUtcDay(tomorrow)).toBe(false);
  });
});

describe('buildStartedAtFilter', () => {
  it('returns undefined when neither bound is given', () => {
    expect(buildStartedAtFilter()).toBeUndefined();
  });

  it('sets only a lower bound when given a start', () => {
    expect(buildStartedAtFilter('2026-03-10')).toEqual({
      gte: d('2026-03-10'),
    });
  });

  it('makes the end date INCLUSIVE by advancing the exclusive upper bound a day', () => {
    // The endDate's own day must count. An exclusive bound at midnight would
    // silently drop everything logged on the last day of the range.
    const filter = buildStartedAtFilter(undefined, '2026-03-10');
    expect(filter?.lt?.toISOString()).toBe('2026-03-11T00:00:00.000Z');
  });

  it('covers a single day when start and end are the same date', () => {
    // "How many hours did I work yesterday" is start = end = yesterday.
    const filter = buildStartedAtFilter('2026-03-10', '2026-03-10');
    expect(filter?.gte?.toISOString()).toBe('2026-03-10T00:00:00.000Z');
    expect(filter?.lt?.toISOString()).toBe('2026-03-11T00:00:00.000Z');
  });
});
