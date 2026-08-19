import { MAX_CONTINUOUS_SESSION_MINUTES } from '@/projects/time-entries/time-entries.constants';

// Shared date math for both TimeEntry and MeetingTimeEntry. Moved out of
// ProjectTimeEntriesService (where buildStartedAtFilter used to live as a
// private method) because MeetingTimeEntriesService and the cross-project
// daily summary endpoint need the exact same semantics. Unlike the small
// authorization/invariant checks this module otherwise duplicates per
// service, this is pure date math with no judgment call in it, so drifting
// out of sync here would silently break one of the call sites' date
// filters.

// Covers whole days, inclusive on both ends. endDate's day itself counts, so
// "yesterday" is startDate=endDate=yesterday's date, not an exclusive upper
// bound that would cut off entries started that same day.
export function buildStartedAtFilter(
  startDate?: string,
  endDate?: string,
): { gte?: Date; lt?: Date } | undefined {
  const filter: { gte?: Date; lt?: Date } = {};
  if (startDate) {
    filter.gte = new Date(startDate);
  }
  if (endDate) {
    const endExclusive = new Date(endDate);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    filter.lt = endExclusive;
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

// 23:59:59.999 UTC on the day `date` falls on. Same UTC calendar day
// convention toDateOnly() already uses in daily-work-report.service.ts.
export function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

// True once the UTC calendar day `date` falls on is strictly before today's
// UTC calendar day.
export function isPreviousUtcDay(date: Date): boolean {
  const now = new Date();
  const dayOf = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return dayOf(date) < dayOf(now);
}

// The moment a RUNNING segment must be finalized by, whichever comes first:
// the 9 hour continuous session cap, or the end of the UTC day it started
// on. A segment that started earlier today can still run past its own 9
// hour cap; a segment that started on an earlier UTC day is always cut off
// at that day's end, even if under 9 hours.
export function getAutoStopCutoff(startedAt: Date): Date {
  const sessionCapCutoff = new Date(
    startedAt.getTime() + MAX_CONTINUOUS_SESSION_MINUTES * 60_000,
  );
  const dayBoundaryCutoff = endOfUtcDay(startedAt);
  return sessionCapCutoff < dayBoundaryCutoff
    ? sessionCapCutoff
    : dayBoundaryCutoff;
}
