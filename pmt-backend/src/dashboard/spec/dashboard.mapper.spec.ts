import {
  BlockerSeverity,
  Permission,
  ProjectPriority,
  ProjectRole,
  ProjectStatus,
} from '@prisma/client';

import {
  BLOCKER_SEVERITY_DISPLAY,
  PROJECT_STATUS_DISPLAY,
} from '@/common/utils/enum-display.util';
import { ROLE_PERMISSIONS } from '@/config/roles.config';
import {
  resolveDashboardAudience,
  toCounts,
  toDashboardClientProject,
  toDashboardHours,
  toDashboardProject,
  tallyOpenBlockers,
  toRate,
  type DashboardProjectRow,
} from '@/dashboard/dashboard.mapper';

describe('resolveDashboardAudience', () => {
  /**
   * Driven from `ROLE_PERMISSIONS` rather than from hand written permission
   * lists, because the thing that can break this is a role's grants changing.
   * A literal list here would keep passing while the real answer moved.
   */
  it.each([
    ['SYSTEM_ADMIN', 'ADMIN'],
    ['ADMIN', 'ADMIN'],
    ['PROJECT_MANAGER', 'MANAGER'],
    ['DEVELOPER', 'STAFF'],
    ['DESIGNER', 'STAFF'],
    ['CLIENT', 'CLIENT'],
  ] as const)('gives %s the %s dashboard', (role, expected) => {
    expect(resolveDashboardAudience(ROLE_PERMISSIONS[role])).toBe(expected);
  });

  it('prefers ADMIN over the wider grants an admin also holds', () => {
    // The ordering bug this guards against: an ADMIN holds VIEW_ALL_PROJECTS
    // and TRACK_PROJECT_TIME too, so testing for either first hands an
    // administrator the manager or the staff dashboard.
    expect(
      resolveDashboardAudience([
        Permission.TRACK_PROJECT_TIME,
        Permission.VIEW_ALL_PROJECTS,
        Permission.VIEW_AUDIT_LOG,
      ]),
    ).toBe('ADMIN');
  });

  it('prefers MANAGER over STAFF when a role holds both', () => {
    expect(
      resolveDashboardAudience([
        Permission.TRACK_PROJECT_TIME,
        Permission.VIEW_ALL_PROJECTS,
      ]),
    ).toBe('MANAGER');
  });

  it('falls back to CLIENT for an empty permission set', () => {
    // The reduced projection is the safe default: a caller nobody has decided
    // about must not receive internal figures.
    expect(resolveDashboardAudience([])).toBe('CLIENT');
  });

  it('never gives a CLIENT anything but the client dashboard', () => {
    // The disclosure case. A client reaching an internal block is a leak, not a
    // cosmetic bug, so it is asserted against the real grant list.
    expect(resolveDashboardAudience(ROLE_PERMISSIONS.CLIENT)).toBe('CLIENT');
  });
});

describe('toDashboardProject', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');

  const base: DashboardProjectRow = {
    id: 'p1',
    name: 'Acme corporate site',
    status: ProjectStatus.IN_PROGRESS,
    priority: ProjectPriority.HIGH,
    deadline: new Date('2026-08-25T00:00:00.000Z'),
    plannedStartDate: new Date('2026-08-01T00:00:00.000Z'),
    progressPercentage: 40,
    estimatedHours: 120,
    actualHours: 47.5,
    members: [
      {
        role: ProjectRole.DEVELOPER,
        leftAt: null,
        user: { id: 'u2', name: 'Bea Dev', avatarUrl: null },
      },
      {
        role: ProjectRole.PROJECT_MANAGER,
        leftAt: null,
        user: { id: 'u1', name: 'Ada Manager', avatarUrl: 'https://cdn/a.jpg' },
      },
      {
        role: ProjectRole.DESIGNER,
        leftAt: new Date('2026-07-01T00:00:00.000Z'),
        user: { id: 'u3', name: 'Gone Designer', avatarUrl: null },
      },
    ],
  };

  const noBlockers = { openCount: 0, highSeverityCount: 0 };

  it('sends every enum as a display object, never a bare value', () => {
    const result = toDashboardProject(base, noBlockers, now);

    expect(result.status).toEqual({
      value: 'IN_PROGRESS',
      label: 'In progress',
      tone: 'primary',
    });
    expect(result.priority.value).toBe('HIGH');
    expect(result.priority.label).toBe('High');
  });

  it('computes remaining hours from the estimate', () => {
    expect(toDashboardProject(base, noBlockers, now).remainingHours).toBe(72.5);
  });

  it('leaves remaining hours null when there is no estimate', () => {
    // Null, not 0: "remaining" has nothing to be remaining against, and 0 would
    // read as "no work left".
    const result = toDashboardProject(
      { ...base, estimatedHours: null },
      noBlockers,
      now,
    );
    expect(result.remainingHours).toBeNull();
  });

  it('marks a live project past its deadline as overdue', () => {
    const result = toDashboardProject(
      { ...base, deadline: new Date('2026-08-18T00:00:00.000Z') },
      noBlockers,
      now,
    );
    expect(result.daysUntilDeadline).toBeLessThan(0);
    expect(result.isOverdue).toBe(true);
  });

  it.each([ProjectStatus.COMPLETED, ProjectStatus.CANCELLED])(
    'never marks a %s project overdue, however late its deadline',
    (status) => {
      // A finished project is finished. Showing it in red forever would make the
      // overdue count useless as a call to action.
      const result = toDashboardProject(
        { ...base, status, deadline: new Date('2020-01-01T00:00:00.000Z') },
        noBlockers,
        now,
      );
      expect(result.isOverdue).toBe(false);
    },
  );

  it('reports no deadline as null rather than as a distant date', () => {
    const result = toDashboardProject(
      { ...base, deadline: null },
      noBlockers,
      now,
    );
    expect(result.daysUntilDeadline).toBeNull();
    expect(result.isOverdue).toBe(false);
  });

  it.each([
    [ProjectStatus.READY_FOR_WORK, true],
    [ProjectStatus.IN_PROGRESS, true],
    [ProjectStatus.PLANNING, false],
    [ProjectStatus.ON_HOLD, false],
    [ProjectStatus.INTERNAL_REVIEW, false],
    [ProjectStatus.COMPLETED, false],
  ] as const)('marks %s as active=%s', (status, isActive) => {
    // Drives the "active before inactive" ordering requirement, so it is pinned
    // per status rather than assumed.
    expect(
      toDashboardProject({ ...base, status }, noBlockers, now).isActive,
    ).toBe(isActive);
  });

  it('passes the blocker tally through rather than recounting it', () => {
    const result = toDashboardProject(
      base,
      { openCount: 3, highSeverityCount: 1 },
      now,
    );
    expect(result.openBlockerCount).toBe(3);
    expect(result.highSeverityBlockerCount).toBe(1);
  });

  it('puts the project manager first, then sorts by name', () => {
    // The card renders avatars in this order, so the first one should be the
    // person who owns the project.
    expect(
      toDashboardProject(base, noBlockers, now).members.map((m) => m.name),
    ).toEqual(['Ada Manager', 'Bea Dev']);
  });

  it('leaves former members off the card', () => {
    // Someone who left is part of the project's history, which the activity
    // timeline carries. Putting them on the card claims they are working on it.
    const names = toDashboardProject(base, noBlockers, now).members.map(
      (m) => m.name,
    );
    expect(names).not.toContain('Gone Designer');
  });

  it('sends each member’s project role as a display object', () => {
    const [first] = toDashboardProject(base, noBlockers, now).members;
    expect(first.projectRole).toEqual({
      value: 'PROJECT_MANAGER',
      label: expect.any(String),
      tone: expect.any(String),
    });
  });
});

describe('toDashboardClientProject', () => {
  it('returns status and deadline, and no internal field', () => {
    const result = toDashboardClientProject(
      {
        id: 'p1',
        name: 'Acme corporate site',
        status: ProjectStatus.WAITING_FOR_FEEDBACK,
        deadline: new Date('2026-09-01T00:00:00.000Z'),
      },
      true,
    );

    expect(Object.keys(result).sort()).toEqual([
      'deadline',
      'id',
      'isAwaitingMyFeedback',
      'name',
      'status',
    ]);
    // Named explicitly: these are the fields a client must never receive, and
    // the assertion above only catches their absence by coincidence of sorting.
    expect(result).not.toHaveProperty('actualHours');
    expect(result).not.toHaveProperty('estimatedHours');
    expect(result).not.toHaveProperty('openBlockerCount');
    expect(result).not.toHaveProperty('priority');
  });
});

describe('toDashboardHours', () => {
  it.each([
    [0, 0, '0m'],
    [45, 0.75, '45m'],
    [450, 7.5, '7h 30m'],
    [480, 8, '8h'],
  ])('%d minutes is %s hours, labelled %s', (minutes, hours, label) => {
    // The exact minute count always ships alongside the rounded hours and the
    // label (ADR 0003), so nothing formatted ever feeds a calculation.
    expect(toDashboardHours(minutes)).toEqual({ minutes, hours, label });
  });
});

describe('toRate', () => {
  it('returns the rate and a percentage label', () => {
    expect(toRate(9, 12)).toEqual({ rate: 0.75, rateLabel: '75%' });
  });

  it('returns null, NOT zero, when nobody was expected', () => {
    // The distinction that matters: on a day when the whole team is on leave,
    // "nobody submitted" and "nobody was expected to" are different answers,
    // and a client receiving 0 for both cannot tell them apart.
    expect(toRate(0, 0)).toEqual({ rate: null, rateLabel: null });
  });

  it('returns zero when people were expected and none submitted', () => {
    expect(toRate(0, 5)).toEqual({ rate: 0, rateLabel: '0%' });
  });

  it('treats a negative denominator as no denominator', () => {
    expect(toRate(1, -1).rate).toBeNull();
  });
});

describe('toCounts', () => {
  it('returns the enum’s declared order, not descending by count', () => {
    // Sorting by count reorders the board every time a project moves, so a
    // reader can never learn where to look.
    const counts = new Map<ProjectStatus, number>([
      [ProjectStatus.COMPLETED, 9],
      [ProjectStatus.PLANNING, 1],
      [ProjectStatus.IN_PROGRESS, 4],
    ]);

    expect(
      toCounts(PROJECT_STATUS_DISPLAY, counts).map((row) => row.key.value),
    ).toEqual(['PLANNING', 'IN_PROGRESS', 'COMPLETED']);
  });

  it('omits keys with no rows', () => {
    const counts = new Map<ProjectStatus, number>([
      [ProjectStatus.PLANNING, 2],
    ]);

    expect(toCounts(PROJECT_STATUS_DISPLAY, counts)).toEqual([
      { key: expect.objectContaining({ value: 'PLANNING' }), count: 2 },
    ]);
  });

  it('returns an empty list when nothing is counted', () => {
    expect(toCounts(PROJECT_STATUS_DISPLAY, new Map())).toEqual([]);
  });

  it('works for any display map, not just project status', () => {
    const counts = new Map([['HIGH', 2] as const]);
    const result = toCounts(BLOCKER_SEVERITY_DISPLAY, counts as never);

    expect(result).toHaveLength(1);
    expect(result[0].key.value).toBe('HIGH');
  });
});

describe('tallyOpenBlockers', () => {
  it('counts every row, and the high severity ones separately', () => {
    // One pass over one list, so the two numbers cannot disagree about which
    // rows are unresolved.
    expect(
      tallyOpenBlockers([
        { severity: BlockerSeverity.HIGH },
        { severity: BlockerSeverity.LOW },
        { severity: BlockerSeverity.HIGH },
        { severity: BlockerSeverity.MEDIUM },
      ]),
    ).toEqual({ openCount: 4, highSeverityCount: 2 });
  });

  it('returns zeroes for an empty list', () => {
    // Zero is right here, unlike a rate: "no blockers" is a measured result.
    expect(tallyOpenBlockers([])).toEqual({
      openCount: 0,
      highSeverityCount: 0,
    });
  });
});
