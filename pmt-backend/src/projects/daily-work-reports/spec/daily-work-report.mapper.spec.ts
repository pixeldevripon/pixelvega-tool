import { DailyWorkReportStatus } from '@prisma/client';

import {
  DailyWorkReportWithRelations,
  WRAP_UP_EDIT_WINDOW_MS,
  canEditPlan,
  canEditWrapUp,
  canSubmitWrapUp,
  toDailyWorkReportResponse,
} from '@/projects/daily-work-reports/daily-work-report.mapper';

const AUTHOR = 'u1';
const SOMEONE_ELSE = 'u2';
const SUBMITTED = new Date('2026-08-12T18:00:00.000Z');

function report(
  overrides: Partial<DailyWorkReportWithRelations> = {},
): DailyWorkReportWithRelations {
  return {
    id: 'r1',
    userId: AUTHOR,
    date: new Date('2026-08-12T00:00:00.000Z'),
    status: DailyWorkReportStatus.PLAN_SUBMITTED,
    planSubmittedAt: new Date('2026-08-12T09:15:00.000Z'),
    wrapUpSubmittedAt: null,
    planFeedSlackTs: null,
    wrapUpFeedSlackTs: null,
    createdAt: new Date('2026-08-12T09:15:00.000Z'),
    updatedAt: new Date('2026-08-12T09:15:00.000Z'),
    entries: [],
    ...overrides,
  };
}

describe('canEditPlan', () => {
  it('allows an edit while only the plan is in', () => {
    expect(canEditPlan({ status: DailyWorkReportStatus.PLAN_SUBMITTED })).toBe(
      true,
    );
  });

  it('locks the plan once the wrap up is submitted', () => {
    // The day is over. Editing what you said you would do, after saying what
    // you did, is rewriting history.
    expect(canEditPlan({ status: DailyWorkReportStatus.COMPLETED })).toBe(
      false,
    );
  });

  it('does not allow editing a draft that was never submitted', () => {
    expect(canEditPlan({ status: DailyWorkReportStatus.DRAFT })).toBe(false);
  });
});

describe('canEditWrapUp', () => {
  const completed = {
    status: DailyWorkReportStatus.COMPLETED,
    wrapUpSubmittedAt: SUBMITTED,
  };

  it('allows a correction immediately after submitting', () => {
    expect(canEditWrapUp(completed, SUBMITTED.getTime())).toBe(true);
  });

  it('allows a correction one millisecond inside the window', () => {
    const now = SUBMITTED.getTime() + WRAP_UP_EDIT_WINDOW_MS - 1;
    expect(canEditWrapUp(completed, now)).toBe(true);
  });

  it('refuses exactly at the window boundary', () => {
    // The boundary is where a time window goes wrong, so it is pinned to the
    // millisecond rather than tested approximately.
    const now = SUBMITTED.getTime() + WRAP_UP_EDIT_WINDOW_MS;
    expect(canEditWrapUp(completed, now)).toBe(false);
  });

  it('refuses when no wrap up has been submitted', () => {
    expect(
      canEditWrapUp({
        status: DailyWorkReportStatus.PLAN_SUBMITTED,
        wrapUpSubmittedAt: null,
      }),
    ).toBe(false);
  });

  it('refuses when the status says completed but the timestamp is missing', () => {
    // Inconsistent data must fail closed, not open a window with no start.
    expect(
      canEditWrapUp({
        status: DailyWorkReportStatus.COMPLETED,
        wrapUpSubmittedAt: null,
      }),
    ).toBe(false);
  });
});

describe('canSubmitWrapUp', () => {
  it('is owed while only the plan is in, and not once completed', () => {
    expect(
      canSubmitWrapUp({ status: DailyWorkReportStatus.PLAN_SUBMITTED }),
    ).toBe(true);
    expect(canSubmitWrapUp({ status: DailyWorkReportStatus.COMPLETED })).toBe(
      false,
    );
  });
});

describe('toDailyWorkReportResponse', () => {
  it('renders the date as a calendar day, never as an instant', () => {
    // A @db.Date column carries no timezone. Sending an ISO instant would make
    // every client guess, and the ones behind UTC would guess the day before.
    expect(toDailyWorkReportResponse(report(), { callerId: AUTHOR }).date).toBe(
      '2026-08-12',
    );
  });

  it('returns status as a display object', () => {
    expect(
      toDailyWorkReportResponse(report(), { callerId: AUTHOR }).status,
    ).toEqual({
      value: 'PLAN_SUBMITTED',
      label: 'Plan submitted',
      tone: 'warning',
    });
  });

  it('counts the entries so a client does not have to', () => {
    const result = toDailyWorkReportResponse(
      report({
        entries: [
          { id: 'e1', dailyWorkReportId: 'r1', projectId: 'p1', plan: 'x' },
          { id: 'e2', dailyWorkReportId: 'r1', projectId: 'p2', plan: 'y' },
        ] as DailyWorkReportWithRelations['entries'],
      }),
      { callerId: AUTHOR },
    );
    expect(result.entryCount).toBe(2);
  });

  describe('capabilities', () => {
    it('gives the author the plan edit and the wrap up submission', () => {
      expect(
        toDailyWorkReportResponse(report(), { callerId: AUTHOR }).capabilities,
      ).toEqual({
        canEditPlan: true,
        canEditWrapUp: false,
        canSubmitWrapUp: true,
      });
    });

    it('gives a reader nothing, however senior', () => {
      // Every edit belongs to the author. An admin fixing a locked wrap up is
      // a conversation, not a button.
      expect(
        toDailyWorkReportResponse(report(), { callerId: SOMEONE_ELSE })
          .capabilities,
      ).toEqual({
        canEditPlan: false,
        canEditWrapUp: false,
        canSubmitWrapUp: false,
      });
    });

    it('flips to the wrap up edit once the day is completed', () => {
      const result = toDailyWorkReportResponse(
        report({
          status: DailyWorkReportStatus.COMPLETED,
          wrapUpSubmittedAt: new Date(),
        }),
        { callerId: AUTHOR },
      );
      expect(result.capabilities).toEqual({
        canEditPlan: false,
        canEditWrapUp: true,
        canSubmitWrapUp: false,
      });
    });
  });

  describe('entry capabilities', () => {
    const withEntry = report({
      entries: [
        {
          id: 'e1',
          dailyWorkReportId: 'r1',
          projectId: 'p1',
          plan: 'Ship it',
          accomplishments: null,
          reviewedAt: null,
          reviewComment: null,
        },
      ] as DailyWorkReportWithRelations['entries'],
    });

    it('refuses to let an author review their own entry', () => {
      const result = toDailyWorkReportResponse(withEntry, { callerId: AUTHOR });
      expect(result.entries[0].capabilities.canReview).toBe(false);
    });

    it("lets someone who manages the entry's project review it", () => {
      const result = toDailyWorkReportResponse(withEntry, {
        callerId: SOMEONE_ELSE,
        managedProjectIds: new Set(['p1']),
      });
      expect(result.entries[0].capabilities.canReview).toBe(true);
    });

    it('refuses someone who does not manage that project', () => {
      // Reviewing is a manager's act: DailyProjectEntryService.review admits
      // the project's PROJECT_MANAGER, ADMIN and SYSTEM_ADMIN, nobody else.
      // This flag used to be only `callerId !== authorId`, so a DEVELOPER
      // reading a colleague's report was offered a review that 403s, and a
      // DEVELOPER does not even hold REVIEW_WORK_REPORT.
      const result = toDailyWorkReportResponse(withEntry, {
        callerId: SOMEONE_ELSE,
        managedProjectIds: new Set(['a-different-project']),
      });
      expect(result.entries[0].capabilities.canReview).toBe(false);
    });

    it("refuses when the caller's managed projects were not computed", () => {
      // Absent has to mean "no", not "yes". The own-report paths in the service
      // deliberately omit it, and an omission must never widen a capability.
      const result = toDailyWorkReportResponse(withEntry, {
        callerId: SOMEONE_ELSE,
      });
      expect(result.entries[0].capabilities.canReview).toBe(false);
    });

    it('still refuses the author, even where they manage the project', () => {
      // Reviewing your own work is not a review, whatever else is true.
      const result = toDailyWorkReportResponse(withEntry, {
        callerId: AUTHOR,
        managedProjectIds: new Set(['p1']),
      });
      expect(result.entries[0].capabilities.canReview).toBe(false);
    });

    it('answers hasPlan and hasWrapUp so a client never tests a string', () => {
      const result = toDailyWorkReportResponse(withEntry, { callerId: AUTHOR });
      expect(result.entries[0].hasPlan).toBe(true);
      expect(result.entries[0].hasWrapUp).toBe(false);
      expect(result.entries[0].isReviewed).toBe(false);
    });

    it('treats an empty string as absent, not as content', () => {
      const result = toDailyWorkReportResponse(
        report({
          entries: [
            { id: 'e1', dailyWorkReportId: 'r1', projectId: 'p1', plan: '' },
          ] as DailyWorkReportWithRelations['entries'],
        }),
        { callerId: AUTHOR },
      );
      expect(result.entries[0].hasPlan).toBe(false);
    });
  });
});
