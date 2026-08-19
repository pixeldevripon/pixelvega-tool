import { TimeEntryStatus } from '@prisma/client';

import {
  MeetingTimeEntryWithRelations,
  TimeEntryWithRelations,
  toDailyTimeTotal,
  toMeetingTimeEntryResponse,
  toProjectTimeTotal,
  toTimeEntryResponse,
  toTotals,
} from '@/projects/time-entries/time-entry.mapper';

const AT = new Date('2026-08-12T09:00:00.000Z');
const OWNER = { callerId: 'u1' };
const SOMEONE_ELSE = { callerId: 'u2' };

function entry(
  overrides: Partial<TimeEntryWithRelations> = {},
): TimeEntryWithRelations {
  return {
    id: 't1',
    projectId: 'p1',
    userId: 'u1',
    sessionId: 's1',
    status: TimeEntryStatus.RUNNING,
    notes: null,
    startedAt: AT,
    endedAt: null,
    durationMinutes: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

describe('toTimeEntryResponse', () => {
  it('returns status as a display object', () => {
    expect(toTimeEntryResponse(entry(), OWNER).status).toEqual({
      value: 'RUNNING',
      label: 'Running',
      tone: 'success',
    });
  });

  it('leaves duration null while the segment is still running', () => {
    // A running segment has not finished, so it has no duration yet. Reporting
    // zero would be a different and false claim.
    const result = toTimeEntryResponse(entry(), OWNER);
    expect(result.durationMinutes).toBeNull();
    expect(result.durationLabel).toBeNull();
  });

  it('carries exact minutes and a label side by side once stopped', () => {
    const result = toTimeEntryResponse(
      entry({
        status: TimeEntryStatus.STOPPED,
        durationMinutes: 450,
        endedAt: AT,
      }),
      OWNER,
    );
    expect(result.durationMinutes).toBe(450);
    expect(result.durationLabel).toBe('7h 30m');
  });

  it('omits the relations that were not selected rather than sending nulls', () => {
    const result = toTimeEntryResponse(entry(), OWNER);
    expect(result).not.toHaveProperty('user');
    expect(result).not.toHaveProperty('project');
  });

  it('includes the relations when the query selected them', () => {
    const result = toTimeEntryResponse(
      entry({
        user: { id: 'u1', name: 'Rezina Akter', email: 'rezina@pixelvega.com' },
        project: { id: 'p1', name: 'Acme corporate site' },
      }),
      OWNER,
    );
    expect(result.user?.name).toBe('Rezina Akter');
    expect(result.project?.name).toBe('Acme corporate site');
  });

  describe('capabilities', () => {
    it('lets the owner pause and stop a running segment, but not resume it', () => {
      expect(toTimeEntryResponse(entry(), OWNER).capabilities).toEqual({
        canPause: true,
        canResume: false,
        canStop: true,
      });
    });

    it('lets the owner resume and stop a paused segment, but not pause it again', () => {
      expect(
        toTimeEntryResponse(entry({ status: TimeEntryStatus.PAUSED }), OWNER)
          .capabilities,
      ).toEqual({ canPause: false, canResume: true, canStop: true });
    });

    it('offers nothing on a stopped segment', () => {
      // Stopping is final. Every control being false is what stops a UI earning
      // the 409 the service would answer with.
      expect(
        toTimeEntryResponse(entry({ status: TimeEntryStatus.STOPPED }), OWNER)
          .capabilities,
      ).toEqual({ canPause: false, canResume: false, canStop: false });
    });

    it('offers nothing on a timer belonging to someone else', () => {
      // The ownership rule survives admin deliberately: a timer belongs to the
      // person running it, and nobody else stops it.
      expect(toTimeEntryResponse(entry(), SOMEONE_ELSE).capabilities).toEqual({
        canPause: false,
        canResume: false,
        canStop: false,
      });
    });
  });
});

describe('toMeetingTimeEntryResponse', () => {
  it('has no project, and the same capability rules', () => {
    const meeting = {
      id: 'm1',
      userId: 'u1',
      sessionId: 's1',
      status: TimeEntryStatus.RUNNING,
      notes: 'Sprint planning',
      startedAt: AT,
      endedAt: null,
      durationMinutes: null,
      createdAt: AT,
      updatedAt: AT,
    } as MeetingTimeEntryWithRelations;

    const result = toMeetingTimeEntryResponse(meeting, OWNER);
    expect(result).not.toHaveProperty('projectId');
    expect(result.capabilities).toEqual({
      canPause: true,
      canResume: false,
      canStop: true,
    });
  });
});

describe('toTotals', () => {
  it('expresses one exact figure three ways', () => {
    expect(toTotals(2530)).toEqual({
      totalMinutes: 2530,
      totalHours: 42.17,
      totalLabel: '42h 10m',
    });
  });

  it('handles zero without producing a null label', () => {
    expect(toTotals(0)).toEqual({
      totalMinutes: 0,
      totalHours: 0,
      totalLabel: '0m',
    });
  });

  it('keeps the exact minutes untouched by the rounding', () => {
    // The rounding is for reading. Anything that adds up must use the minutes.
    const totals = toTotals(20);
    expect(totals.totalMinutes).toBe(20);
    expect(totals.totalHours).toBe(0.33);
  });
});

describe('the total builders', () => {
  it('attaches all three totals to a project row', () => {
    expect(
      toProjectTimeTotal({
        projectId: 'p1',
        projectName: 'Acme',
        totalMinutes: 900,
      }),
    ).toEqual({
      projectId: 'p1',
      projectName: 'Acme',
      totalMinutes: 900,
      totalHours: 15,
      totalLabel: '15h',
    });
  });

  it('attaches all three totals to a day row', () => {
    expect(toDailyTimeTotal({ date: '2026-08-12', totalMinutes: 450 })).toEqual(
      {
        date: '2026-08-12',
        totalMinutes: 450,
        totalHours: 7.5,
        totalLabel: '7h 30m',
      },
    );
  });
});
