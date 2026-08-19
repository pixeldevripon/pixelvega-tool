import {
  AdditionalRequirementStatus,
  AiJobStatus,
  AiJobType,
  AiTemplateKind,
  AvailabilityStatus,
  BlockerSeverity,
  BlockerStatus,
  ClientFeedbackDecision,
  DailyWorkReportStatus,
  EmployeeWorkStatus,
  InternalReviewDecision,
  LeaveStatus,
  NotificationType,
  ProjectDocumentFormat,
  ProjectDocumentType,
  ProjectActivityType,
  ProjectPriority,
  ProjectRole,
  ProjectStatus,
  ProjectType,
  Role,
  TimeEntryStatus,
  UserStatus,
} from '@prisma/client';

import { DISPLAY_TONES } from '@/common/dto/display.dto';
import {
  ADDITIONAL_REQUIREMENT_STATUS_DISPLAY,
  AI_JOB_STATUS_DISPLAY,
  AI_JOB_TYPE_DISPLAY,
  AI_TEMPLATE_KIND_DISPLAY,
  NOTIFICATION_TYPE_DISPLAY,
  PROJECT_ACTIVITY_TYPE_DISPLAY,
  AVAILABILITY_STATUS_DISPLAY,
  BLOCKER_SEVERITY_DISPLAY,
  BLOCKER_STATUS_DISPLAY,
  CLIENT_FEEDBACK_DECISION_DISPLAY,
  DAILY_WORK_REPORT_STATUS_DISPLAY,
  EMPLOYEE_WORK_STATUS_DISPLAY,
  INTERNAL_REVIEW_DECISION_DISPLAY,
  LEAVE_STATUS_DISPLAY,
  PROJECT_DOCUMENT_FORMAT_DISPLAY,
  PROJECT_DOCUMENT_TYPE_DISPLAY,
  PROJECT_PRIORITY_DISPLAY,
  PROJECT_ROLE_DISPLAY,
  PROJECT_STATUS_DISPLAY,
  PROJECT_TYPE_DISPLAY,
  ROLE_DISPLAY,
  TIME_ENTRY_STATUS_DISPLAY,
  USER_STATUS_DISPLAY,
  toEnumDisplay,
  toEnumDisplayList,
} from './enum-display.util';

/**
 * Every map, paired with the Prisma enum it must cover.
 *
 * Driven from `Object.values(TheEnum)` rather than a hand written list, so the
 * completeness assertions below cannot pass by being out of date themselves.
 */
const MAPS: Array<
  [
    string,
    Record<string, string>,
    Record<string, { label: string; tone: string }>,
  ]
> = [
  ['ProjectStatus', ProjectStatus, PROJECT_STATUS_DISPLAY],
  ['ProjectPriority', ProjectPriority, PROJECT_PRIORITY_DISPLAY],
  ['ProjectType', ProjectType, PROJECT_TYPE_DISPLAY],
  ['ProjectRole', ProjectRole, PROJECT_ROLE_DISPLAY],
  ['ProjectDocumentType', ProjectDocumentType, PROJECT_DOCUMENT_TYPE_DISPLAY],
  [
    'ProjectDocumentFormat',
    ProjectDocumentFormat,
    PROJECT_DOCUMENT_FORMAT_DISPLAY,
  ],
  ['Role', Role, ROLE_DISPLAY],
  ['UserStatus', UserStatus, USER_STATUS_DISPLAY],
  ['EmployeeWorkStatus', EmployeeWorkStatus, EMPLOYEE_WORK_STATUS_DISPLAY],
  ['AvailabilityStatus', AvailabilityStatus, AVAILABILITY_STATUS_DISPLAY],
  ['LeaveStatus', LeaveStatus, LEAVE_STATUS_DISPLAY],
  ['TimeEntryStatus', TimeEntryStatus, TIME_ENTRY_STATUS_DISPLAY],
  [
    'DailyWorkReportStatus',
    DailyWorkReportStatus,
    DAILY_WORK_REPORT_STATUS_DISPLAY,
  ],
  ['BlockerStatus', BlockerStatus, BLOCKER_STATUS_DISPLAY],
  ['BlockerSeverity', BlockerSeverity, BLOCKER_SEVERITY_DISPLAY],
  [
    'InternalReviewDecision',
    InternalReviewDecision,
    INTERNAL_REVIEW_DECISION_DISPLAY,
  ],
  [
    'ClientFeedbackDecision',
    ClientFeedbackDecision,
    CLIENT_FEEDBACK_DECISION_DISPLAY,
  ],
  [
    'AdditionalRequirementStatus',
    AdditionalRequirementStatus,
    ADDITIONAL_REQUIREMENT_STATUS_DISPLAY,
  ],
  ['AiJobStatus', AiJobStatus, AI_JOB_STATUS_DISPLAY],
  ['AiJobType', AiJobType, AI_JOB_TYPE_DISPLAY],
  ['AiTemplateKind', AiTemplateKind, AI_TEMPLATE_KIND_DISPLAY],
  ['ProjectActivityType', ProjectActivityType, PROJECT_ACTIVITY_TYPE_DISPLAY],
  ['NotificationType', NotificationType, NOTIFICATION_TYPE_DISPLAY],
];

describe('enum display maps', () => {
  describe.each(MAPS)('%s', (_name, prismaEnum, map) => {
    it('covers every member of the Prisma enum, and invents none', () => {
      // The compiler already enforces this via `Record<TheEnum, ...>`. Asserting
      // it again at runtime catches the one way that guarantee is lost: someone
      // widening a map's type to `Record<string, ...>` to silence an error.
      expect(Object.keys(map).sort()).toEqual(Object.values(prismaEnum).sort());
    });

    it('gives every member a tone from the closed set', () => {
      for (const entry of Object.values(map)) {
        expect(DISPLAY_TONES).toContain(entry.tone);
      }
    });

    it('gives every member a label that is not the raw enum value', () => {
      for (const [value, entry] of Object.entries(map)) {
        expect(entry.label.length).toBeGreaterThan(0);
        // An underscore surviving into a label means someone pasted the enum
        // member in as its own label.
        expect(entry.label).not.toContain('_');
        if (value.includes('_')) expect(entry.label).not.toBe(value);
      }
    });

    it('writes labels in sentence case, not title case', () => {
      // The house style, and the reason the server owns the label at all. Words
      // after the first stay lowercase UNLESS they are a proper noun or acronym,
      // which is exactly the judgment a client side splitter cannot make, so
      // those are allowlisted here rather than being a hole in the rule.
      const PROPER_NOUNS = [
        'MERN',
        'SEO',
        'PRD',
        'WordPress',
        'Webflow',
        'Wix',
        'Framer',
        'Figma',
      ];
      for (const entry of Object.values(map)) {
        const [first, ...rest] = entry.label.split(' ');
        expect(first[0]).toBe(first[0].toUpperCase());
        for (const word of rest) {
          if (PROPER_NOUNS.includes(word)) continue;
          expect(word).toBe(word.toLowerCase());
        }
      }
    });
  });
});

describe('the labels that motivated this file', () => {
  it('spells the acronyms the frontend could not', () => {
    // "Ai Summary", "Mern Stack" and "Seo" are what every generic splitter
    // produced. These three assertions are the whole justification for ADR 0001.
    expect(AI_TEMPLATE_KIND_DISPLAY.PROJECT_SUMMARY.label).toBe(
      'Project summary',
    );
    expect(PROJECT_TYPE_DISPLAY.MERN_STACK.label).toBe('MERN stack');
    expect(PROJECT_TYPE_DISPLAY.SEO.label).toBe('SEO');
    expect(PROJECT_DOCUMENT_TYPE_DISPLAY.PRD.label).toBe('PRD');
  });

  it('keeps the casing of product names', () => {
    expect(PROJECT_TYPE_DISPLAY.WORDPRESS.label).toBe('WordPress');
  });
});

describe('the tone judgments', () => {
  it('reserves danger for outcomes that are actually bad', () => {
    // Requested changes are a normal review step. If they read as `danger` the
    // colour stops meaning anything on a board where most reviews ask for one.
    expect(INTERNAL_REVIEW_DECISION_DISPLAY.CHANGES_REQUIRED.tone).toBe(
      'warning',
    );
    expect(CLIENT_FEEDBACK_DECISION_DISPLAY.CHANGES_REQUESTED.tone).toBe(
      'warning',
    );
    expect(PROJECT_STATUS_DISPLAY.CANCELLED.tone).toBe('danger');
    expect(BLOCKER_STATUS_DISPLAY.OPEN.tone).toBe('danger');
  });

  it('tones both stalled project statuses the same', () => {
    // ON_HOLD and WAITING_FOR_FEEDBACK both mean work has stopped pending
    // someone. Whose turn it is belongs in the label, not the colour.
    expect(PROJECT_STATUS_DISPLAY.ON_HOLD.tone).toBe(
      PROJECT_STATUS_DISPLAY.WAITING_FOR_FEEDBACK.tone,
    );
    expect(PROJECT_STATUS_DISPLAY.ON_HOLD.tone).toBe('warning');
  });

  it('does not flag a draft report as a problem', () => {
    // The frontend rendered everything that was not COMPLETED as a warning.
    expect(DAILY_WORK_REPORT_STATUS_DISPLAY.DRAFT.tone).toBe('default');
    expect(DAILY_WORK_REPORT_STATUS_DISPLAY.PLAN_SUBMITTED.tone).toBe(
      'warning',
    );
  });

  it('makes the root account conspicuous in a user list', () => {
    expect(ROLE_DISPLAY.SYSTEM_ADMIN.tone).toBe('danger');
    expect(ROLE_DISPLAY.CLIENT.tone).toBe('default');
  });
});

describe('toEnumDisplay', () => {
  it('returns all three fields', () => {
    expect(
      toEnumDisplay(PROJECT_STATUS_DISPLAY, ProjectStatus.IN_PROGRESS),
    ).toEqual({
      value: 'IN_PROGRESS',
      label: 'In progress',
      tone: 'primary',
    });
  });

  it('keeps an absent value absent', () => {
    // A nullable column must not become an object meaning "none": the client
    // would then have to special case a priority called "not set".
    expect(toEnumDisplay(PROJECT_PRIORITY_DISPLAY, null)).toBeNull();
    expect(toEnumDisplay(PROJECT_PRIORITY_DISPLAY, undefined)).toBeNull();
  });

  it('degrades to the raw value rather than throwing on an unmapped member', () => {
    // Reachable only mid deploy, when a row holds a member this build predates.
    // A status badge rendering the raw value beats the whole request 500ing.
    const stale = toEnumDisplay(
      PROJECT_STATUS_DISPLAY as Record<
        string,
        { label: string; tone: 'default' }
      >,
      'SOME_FUTURE_STATUS',
    );
    expect(stale).toEqual({
      value: 'SOME_FUTURE_STATUS',
      label: 'SOME_FUTURE_STATUS',
      tone: 'default',
    });
  });
});

describe('toEnumDisplayList', () => {
  it('returns every member in declaration order, for a filter dropdown', () => {
    const list = toEnumDisplayList(PROJECT_PRIORITY_DISPLAY);
    expect(list.map((item) => item.value)).toEqual([
      'LOW',
      'MEDIUM',
      'HIGH',
      'URGENT',
      'CRITICAL',
    ]);
    expect(list[4]).toEqual({
      value: 'CRITICAL',
      label: 'Critical',
      tone: 'danger',
    });
  });
});
