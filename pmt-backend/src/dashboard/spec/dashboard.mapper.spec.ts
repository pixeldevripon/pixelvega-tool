import {
  BlockerSeverity,
  Permission,
  ProjectPriority,
  ProjectRole,
  ProjectStatus,
  ProjectType,
} from '@prisma/client';

import {
  BLOCKER_SEVERITY_DISPLAY,
  PROJECT_STATUS_DISPLAY,
} from '@/common/utils/enum-display.util';
import { ROLE_PERMISSIONS } from '@/config/roles.config';
import {
  buildDashboardProjectCapabilities,
  formatChangeLabel,
  hasMyDay,
  resolveDashboardAudience,
  tallyOpenBlockers,
  toAttention,
  toBreakdown,
  toDashboardClientProject,
  toDashboardHours,
  toDashboardProject,
  toMetric,
  toProjectBoard,
  toRankedRow,
  toRate,
  toSeries,
  type DashboardAttentionCounts,
  type DashboardProjectRow,
} from '@/dashboard/dashboard.mapper';

// ══════════════════════════════════════════════════════════════════════════
// Who gets which dashboard
// ══════════════════════════════════════════════════════════════════════════

describe('resolveDashboardAudience', () => {
  /**
   * Driven from the real `ROLE_PERMISSIONS` rather than from hand written
   * permission lists, because the thing that can break this is a role's grants
   * changing. A literal list here would keep passing while the real answer moved.
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
    // The ordering bug this guards against: an ADMIN holds VIEW_ALL_PROJECTS and
    // TRACK_PROJECT_TIME too, so testing for either first hands an administrator
    // the manager or the staff dashboard.
    expect(
      resolveDashboardAudience([
        Permission.TRACK_PROJECT_TIME,
        Permission.VIEW_ALL_PROJECTS,
        Permission.VIEW_AUDIT_LOG,
      ]),
    ).toBe('ADMIN');
  });

  it('prefers MANAGER over STAFF when a caller holds both markers', () => {
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

describe('hasMyDay', () => {
  it.each(['DEVELOPER', 'DESIGNER'] as const)(
    '%s gets a My day block',
    (role) => {
      expect(hasMyDay(ROLE_PERMISSIONS[role])).toBe(true);
    },
  );

  it('a PROJECT_MANAGER does not, because they track no time', () => {
    // Same reason they have no "My day" in the navigation. An empty timer card
    // would imply a control they do not have.
    expect(hasMyDay(ROLE_PERMISSIONS.PROJECT_MANAGER)).toBe(false);
  });

  it('a CLIENT does not', () => {
    expect(hasMyDay(ROLE_PERMISSIONS.CLIENT)).toBe(false);
  });

  it.each(['ADMIN', 'SYSTEM_ADMIN'] as const)(
    '%s DOES get one, because the permission map grants it',
    (role) => {
      // Pinned because it is surprising and was nearly written the other way.
      // features.md says PMs and Admins cannot track project time, but
      // ROLE_PERMISSIONS grants TRACK_PROJECT_TIME to an admin as part of being a
      // strict superset of every lower role. The permission map is what the API
      // enforces, so hiding the block would hide a control they actually have.
      expect(hasMyDay(ROLE_PERMISSIONS[role])).toBe(true);
    },
  );
});

// ══════════════════════════════════════════════════════════════════════════
// Seeing versus managing
// ══════════════════════════════════════════════════════════════════════════

describe('buildDashboardProjectCapabilities', () => {
  const admin = ROLE_PERMISSIONS.ADMIN;
  const manager = ROLE_PERMISSIONS.PROJECT_MANAGER;
  const developer = ROLE_PERMISSIONS.DEVELOPER;

  it('lets an ADMIN manage a project they are not staffed on', () => {
    // "Admin and system admin can do everything, see every project."
    expect(
      buildDashboardProjectCapabilities({
        permissions: admin,
        isMember: false,
        isProjectManagerOfThis: false,
      }).canManage,
    ).toBe(true);
  });

  it('lets a PROJECT_MANAGER manage a project they manage', () => {
    expect(
      buildDashboardProjectCapabilities({
        permissions: manager,
        isMember: true,
        isProjectManagerOfThis: true,
      }).canManage,
    ).toBe(true);
  });

  it('does NOT let a PROJECT_MANAGER manage a project they only see', () => {
    // The whole point of the split: "projects manager can see every project but
    // can be manage only his project". Seeing it is not managing it.
    expect(
      buildDashboardProjectCapabilities({
        permissions: manager,
        isMember: false,
        isProjectManagerOfThis: false,
      }).canManage,
    ).toBe(false);
  });

  it('does NOT let a PROJECT_MANAGER manage a project they are merely a member of', () => {
    // Staffed as something other than the project manager. Membership alone is
    // not authority.
    expect(
      buildDashboardProjectCapabilities({
        permissions: manager,
        isMember: true,
        isProjectManagerOfThis: false,
      }).canManage,
    ).toBe(false);
  });

  it('never lets a DEVELOPER manage anything, even a project they are on', () => {
    expect(
      buildDashboardProjectCapabilities({
        permissions: developer,
        isMember: true,
        isProjectManagerOfThis: false,
      }).canManage,
    ).toBe(false);
  });

  it('lets a DEVELOPER track time only on a project they are staffed on', () => {
    // Holding the permission is not enough. This mirrors features.md: "Only
    // developers and designers who are assigned to a project can track time on it."
    expect(
      buildDashboardProjectCapabilities({
        permissions: developer,
        isMember: true,
        isProjectManagerOfThis: false,
      }).canTrackTime,
    ).toBe(true);

    expect(
      buildDashboardProjectCapabilities({
        permissions: developer,
        isMember: false,
        isProjectManagerOfThis: false,
      }).canTrackTime,
    ).toBe(false);
  });

  it('never lets a PROJECT_MANAGER track time, even where they may manage', () => {
    // A PM holds no tracking permission at all: features.md says PMs and Admins
    // cannot track project time.
    const result = buildDashboardProjectCapabilities({
      permissions: manager,
      isMember: true,
      isProjectManagerOfThis: true,
    });
    expect(result.canManage).toBe(true);
    expect(result.canTrackTime).toBe(false);
  });

  it('reports membership honestly, whatever the other flags say', () => {
    expect(
      buildDashboardProjectCapabilities({
        permissions: admin,
        isMember: false,
        isProjectManagerOfThis: false,
      }).isMember,
    ).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// The project card
// ══════════════════════════════════════════════════════════════════════════

describe('toDashboardProject', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');
  const noBlockers = { openCount: 0, highSeverityCount: 0 };
  const capabilities = {
    canManage: false,
    canTrackTime: true,
    isMember: true,
  };
  const context = {
    blockers: noBlockers,
    minutesInRange: 450,
    lastWorkedAt: new Date('2026-08-19T15:00:00.000Z'),
    capabilities,
  };

  const base: DashboardProjectRow = {
    id: 'p1',
    name: 'Acme corporate site',
    description: 'Five page marketing site plus a blog.',
    status: ProjectStatus.IN_PROGRESS,
    priority: ProjectPriority.HIGH,
    deadline: new Date('2026-08-25T00:00:00.000Z'),
    plannedStartDate: new Date('2026-08-01T00:00:00.000Z'),
    estimatedHours: 120,
    actualHours: 47.5,
    projectTypeTags: [
      { type: ProjectType.WORDPRESS },
      { type: ProjectType.SEO },
    ],
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

  it('marks a finished project terminal, so a card knows not to print a countdown', () => {
    /**
     * A completed project keeps its deadline, so `deadlineLabel` still reads
     * "138 days overdue" long after the work is done, and `isOverdue` is
     * deliberately false for it. Neither field can tell a card to drop the
     * line, which is why this one ships: the board printed "93 days overdue"
     * under a CANCELLED project.
     */
    for (const status of [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED]) {
      const card = toDashboardProject({ ...base, status }, context, now);
      expect(card.isTerminal).toBe(true);
      expect(card.isOverdue).toBe(false);
      expect(card.isAtRisk).toBe(false);
    }

    expect(
      toDashboardProject(
        { ...base, status: ProjectStatus.IN_PROGRESS },
        context,
        now,
      ).isTerminal,
    ).toBe(false);
  });

  it('carries the description through, and null when there is none', () => {
    // The board card's second line. It reads straight off the row, so the case
    // worth pinning is that a project without one arrives as null rather than
    // as an empty string: the card renders no line at all for null, and would
    // render an empty one for ''.
    expect(toDashboardProject(base, context, now).description).toBe(
      'Five page marketing site plus a blog.',
    );
    expect(
      toDashboardProject({ ...base, description: null }, context, now)
        .description,
    ).toBeNull();
  });

  it('derives progress from the lifecycle, not from hours used', () => {
    // The `progressPercentage` column Project Module.md specifies was never
    // added to the schema, so it is derived from the status machine. Hours-used
    // would be wrong in the most expensive direction: a project can burn 90% of
    // its estimate while still sitting in Planning.
    expect(toDashboardProject(base, context, now).progressPercentage).toBe(40);

    expect(
      toDashboardProject(
        { ...base, status: ProjectStatus.PLANNING },
        // Nearly all the estimate spent, and still 0% done.
        { ...context, minutesInRange: 0 },
        now,
      ).progressPercentage,
    ).toBe(0);

    expect(
      toDashboardProject(
        { ...base, status: ProjectStatus.COMPLETED },
        context,
        now,
      ).progressPercentage,
    ).toBe(100);
  });

  it('keeps ON_HOLD at the progress already made, rather than dropping to zero', () => {
    // Pausing a project does not undo the work already done.
    expect(
      toDashboardProject(
        { ...base, status: ProjectStatus.ON_HOLD },
        context,
        now,
      ).progressPercentage,
    ).toBe(
      toDashboardProject(
        { ...base, status: ProjectStatus.IN_PROGRESS },
        context,
        now,
      ).progressPercentage,
    );
  });

  it('carries lastWorkedAt from the context, since it is not a column', () => {
    // There is no such field on Project: the service reads the latest time
    // entry per project in one grouped query and passes it in.
    expect(toDashboardProject(base, context, now).lastWorkedAt).toEqual(
      new Date('2026-08-19T15:00:00.000Z'),
    );
    expect(
      toDashboardProject(base, { ...context, lastWorkedAt: null }, now)
        .lastWorkedAt,
    ).toBeNull();
  });

  it('sends every enum as a display object, never a bare value', () => {
    const result = toDashboardProject(base, context, now);

    expect(result.status).toEqual({
      value: 'IN_PROGRESS',
      label: 'In progress',
      tone: 'primary',
    });
    expect(result.priority.value).toBe('HIGH');
    expect(result.types.map((type) => type.value)).toEqual([
      'WORDPRESS',
      'SEO',
    ]);
  });

  it('computes remaining hours and the used rate from the estimate', () => {
    const result = toDashboardProject(base, context, now);
    expect(result.remainingHours).toBe(72.5);
    expect(result.hoursUsedRate).toBeCloseTo(0.3958, 4);
  });

  it('sends a readable label beside every hours figure', () => {
    // The defect this prevents was visible on screen: `actualHours` is a float
    // sum of minutes over sixty, so a card rendering it raw showed
    // "56.083333333333336h of 114h". The exact value is for arithmetic, the
    // label is for reading (ADR 0003).
    const result = toDashboardProject(
      { ...base, actualHours: 56.083333333333336, estimatedHours: 114 },
      context,
      now,
    );
    expect(result.actualHoursLabel).toBe('56h 5m');
    expect(result.estimatedHoursLabel).toBe('114h');
    expect(result.remainingHoursLabel).toBe('57h 55m');
  });

  it('leaves the estimate and remaining labels null without an estimate', () => {
    const result = toDashboardProject(
      { ...base, estimatedHours: null },
      context,
      now,
    );
    expect(result.estimatedHoursLabel).toBeNull();
    expect(result.remainingHoursLabel).toBeNull();
    // The actual is always known, so its label is never null.
    expect(result.actualHoursLabel).toBe('47h 30m');
  });

  it('leaves both null when there is no estimate', () => {
    // Null, not 0: "remaining" has nothing to be remaining against, and 0 would
    // read as "no work left".
    const result = toDashboardProject(
      { ...base, estimatedHours: null },
      context,
      now,
    );
    expect(result.remainingHours).toBeNull();
    expect(result.hoursUsedRate).toBeNull();
  });

  it('reports a used rate above 1 when the estimate is exceeded', () => {
    const result = toDashboardProject(
      { ...base, estimatedHours: 40, actualHours: 60 },
      context,
      now,
    );
    expect(result.hoursUsedRate).toBe(1.5);
  });

  it('marks a live project past its deadline as overdue and at risk', () => {
    const result = toDashboardProject(
      { ...base, deadline: new Date('2026-08-18T00:00:00.000Z') },
      context,
      now,
    );
    expect(result.isOverdue).toBe(true);
    expect(result.isAtRisk).toBe(true);
    expect(result.deadlineLabel).toBe('2 days overdue');
  });

  it('marks a blocked project at risk even when its deadline is fine', () => {
    const result = toDashboardProject(
      base,
      { ...context, blockers: { openCount: 1, highSeverityCount: 1 } },
      now,
    );
    expect(result.isOverdue).toBe(false);
    expect(result.isAtRisk).toBe(true);
  });

  it.each([ProjectStatus.COMPLETED, ProjectStatus.CANCELLED])(
    'never marks a %s project overdue or at risk, however late or blocked',
    (status) => {
      // A finished project is finished. Showing it in red forever would make the
      // at-risk count useless as a call to action.
      const result = toDashboardProject(
        { ...base, status, deadline: new Date('2020-01-01T00:00:00.000Z') },
        { ...context, blockers: { openCount: 4, highSeverityCount: 2 } },
        now,
      );
      expect(result.isOverdue).toBe(false);
      expect(result.isAtRisk).toBe(false);
    },
  );

  it('reports no deadline as null rather than as a distant date', () => {
    const result = toDashboardProject(
      { ...base, deadline: null },
      context,
      now,
    );
    expect(result.daysUntilDeadline).toBeNull();
    expect(result.deadlineLabel).toBeNull();
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
    expect(toDashboardProject({ ...base, status }, context, now).isActive).toBe(
      isActive,
    );
  });

  it('passes the blocker tally and range minutes through rather than recounting', () => {
    const result = toDashboardProject(
      base,
      {
        ...context,
        blockers: { openCount: 3, highSeverityCount: 1 },
        minutesInRange: 930,
      },
      now,
    );
    expect(result.openBlockerCount).toBe(3);
    expect(result.highSeverityBlockerCount).toBe(1);
    expect(result.minutesInRange).toBe(930);
    expect(result.minutesInRangeLabel).toBe('15h 30m');
  });

  it('puts the project manager first, then sorts by name', () => {
    // The card renders avatars in this order, so the first should be the person
    // who owns the project.
    expect(
      toDashboardProject(base, context, now).members.map((m) => m.name),
    ).toEqual(['Ada Manager', 'Bea Dev']);
  });

  it('leaves former members off the card', () => {
    // Someone who left is part of the project's history, which the activity
    // timeline carries. Putting them on the card claims they are working on it.
    expect(
      toDashboardProject(base, context, now).members.map((m) => m.name),
    ).not.toContain('Gone Designer');
  });

  it('carries the capabilities it was given, unchanged', () => {
    // The mapper must never re-derive a capability: the service resolves it once
    // from the same predicate its own assertion uses.
    expect(toDashboardProject(base, context, now).capabilities).toEqual(
      capabilities,
    );
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
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(Object.keys(result).sort()).toEqual([
      'deadline',
      'deadlineLabel',
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
    expect(result).not.toHaveProperty('members');
    expect(result).not.toHaveProperty('capabilities');
    expect(result).not.toHaveProperty('priority');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Formatting and figures
// ══════════════════════════════════════════════════════════════════════════

describe('formatChangeLabel', () => {
  it.each([
    [null, null],
    [0, '0%'],
    [0.2727, '+27%'],
    [-0.162, '-16%'],
  ])('%s reads as %s', (rate, expected) => {
    expect(formatChangeLabel(rate)).toBe(expected);
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
    // On a day the whole team is on leave, "nobody submitted" and "nobody was
    // expected to" are different answers, and a client receiving 0 for both
    // cannot tell them apart.
    expect(toRate(0, 0)).toEqual({ rate: null, rateLabel: null });
  });

  it('returns zero when people were expected and none submitted', () => {
    expect(toRate(0, 5)).toEqual({ rate: 0, rateLabel: '0%' });
  });
});

describe('toMetric', () => {
  const shared = { key: 'k', label: 'L', valueLabel: '10' };

  it('computes the change against the previous window', () => {
    const result = toMetric({
      ...shared,
      value: 14,
      previousValue: 11,
      direction: 'neutral',
    });
    expect(result.changeRate).toBeCloseTo(0.2727, 4);
    expect(result.changeLabel).toBe('+27%');
  });

  it('leaves the change null when the baseline was zero', () => {
    // A change from nothing has no percentage, and "+Infinity%" is not a fact
    // about the business.
    const result = toMetric({
      ...shared,
      value: 5,
      previousValue: 0,
      direction: 'up-is-good',
    });
    expect(result.changeRate).toBeNull();
    expect(result.changeLabel).toBeNull();
    expect(result.tone.tone).toBe('default');
  });

  it('leaves the change null when there is no history at all', () => {
    const result = toMetric({
      ...shared,
      value: 5,
      previousValue: null,
      direction: 'up-is-bad',
    });
    expect(result.changeRate).toBeNull();
  });

  it.each([
    ['up-is-good', 12, 10, 'success'],
    ['up-is-good', 8, 10, 'warning'],
    ['up-is-bad', 12, 10, 'danger'],
    ['up-is-bad', 8, 10, 'success'],
    ['neutral', 12, 10, 'default'],
    ['neutral', 8, 10, 'default'],
  ] as const)(
    'a %s metric moving %d from %d reads as %s',
    (direction, value, previousValue, tone) => {
      // Whether up is good is a judgment about the business, not a styling
      // choice, which is why the server decides it (ADR 0001).
      expect(
        toMetric({ ...shared, value, previousValue, direction }).tone.tone,
      ).toBe(tone);
    },
  );

  it('reads as steady when nothing moved', () => {
    expect(
      toMetric({
        ...shared,
        value: 10,
        previousValue: 10,
        direction: 'up-is-bad',
      }).tone.tone,
    ).toBe('default');
  });
});

describe('toSeries', () => {
  const from = new Date('2026-08-17T00:00:00.000Z'); // a Monday

  it('emits one point per day, filling gaps with zero', () => {
    // A chart that skips a day with no hours draws a continuous line over the
    // gap and implies work happened across it.
    const series = toSeries({
      label: 'Hours logged',
      from,
      days: 4,
      minutesByDay: new Map([
        ['2026-08-17', 480],
        ['2026-08-19', 120],
      ]),
      dailyTarget: 480,
    });

    expect(series.points.map((p) => p.date)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);
    expect(series.points.map((p) => p.value)).toEqual([480, 0, 120, 0]);
  });

  it('totals the range and labels it', () => {
    const series = toSeries({
      label: 'Hours logged',
      from,
      days: 3,
      minutesByDay: new Map([
        ['2026-08-17', 480],
        ['2026-08-18', 30],
      ]),
      dailyTarget: null,
    });

    expect(series.totalValue).toBe(510);
    expect(series.totalLabel).toBe('8h 30m');
  });

  it('flags the weekly off day, so a zero can be read correctly', () => {
    // Without this a reader cannot tell the team's day off from a day nobody
    // worked. Friday is the off day for this team.
    const series = toSeries({
      label: 'Hours logged',
      from: new Date('2026-08-21T00:00:00.000Z'), // a Friday
      days: 2,
      minutesByDay: new Map(),
      dailyTarget: null,
    });

    expect(series.points[0].isWorkingDay).toBe(false);
    expect(series.points[1].isWorkingDay).toBe(true);
  });

  it('flags the busiest day as the peak', () => {
    const series = toSeries({
      label: 'Hours logged',
      from,
      days: 4,
      minutesByDay: new Map([
        ['2026-08-17', 120],
        ['2026-08-18', 480],
        ['2026-08-19', 90],
      ]),
      dailyTarget: null,
    });

    expect(series.points.map((p) => p.isPeak)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it('gives the earliest of two equal maxima the peak', () => {
    // A tie broken consistently, so the chart's emphasis does not hop between
    // two identical days depending on which client read the array first.
    const series = toSeries({
      label: 'Hours logged',
      from,
      days: 3,
      minutesByDay: new Map([
        ['2026-08-17', 300],
        ['2026-08-19', 300],
      ]),
      dailyTarget: null,
    });

    expect(series.points.map((p) => p.isPeak)).toEqual([true, false, false]);
  });

  it('passes the daily target through, including a deliberate null', () => {
    // Null is a real answer rather than a missing one. The team-wide series
    // sends it, because TARGET_HOURS_PER_DAY is ONE person's eight hours: drawn
    // under a team logging around 9,000 minutes a day it sat flat on the axis
    // and read as "permanently at goal". `myHoursTrend` keeps the target.
    const team = toSeries({
      label: 'Hours logged',
      from,
      days: 2,
      minutesByDay: new Map([['2026-08-17', 9000]]),
      dailyTarget: null,
    });
    const mine = toSeries({
      label: 'My hours',
      from,
      days: 2,
      minutesByDay: new Map([['2026-08-17', 480]]),
      dailyTarget: 480,
    });

    expect(team.dailyTarget).toBeNull();
    expect(mine.dailyTarget).toBe(480);
  });

  it('flags no peak at all when every day is zero', () => {
    // A fortnight of nothing has no busiest day, and colouring the first bar
    // would claim a shape the data does not have.
    const series = toSeries({
      label: 'Hours logged',
      from,
      days: 3,
      minutesByDay: new Map(),
      dailyTarget: null,
    });

    expect(series.points.every((p) => p.isPeak === false)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Needs attention
// ══════════════════════════════════════════════════════════════════════════

describe('toAttention', () => {
  const counts = (
    overrides: Partial<DashboardAttentionCounts> = {},
  ): DashboardAttentionCounts => ({
    overdueProjects: 0,
    pendingRequirements: 0,
    pendingLeaveRequests: 0,
    notReadyToStart: 0,
    internalReview: 0,
    awaitingClientFeedback: 0,
    ...overrides,
  });

  it('returns the declared order, not descending by count', () => {
    // Sorting by size moves a row every time a project changes, so a reader
    // never learns where to look.
    const attention = toAttention(
      counts({
        overdueProjects: 1,
        pendingRequirements: 9,
        pendingLeaveRequests: 4,
        notReadyToStart: 2,
        internalReview: 7,
        awaitingClientFeedback: 3,
      }),
    );

    expect(attention.items.map((item) => item.key)).toEqual([
      'overdueProjects',
      'pendingRequirements',
      'pendingLeaveRequests',
      'notReadyToStart',
      'internalReview',
      'awaitingClientFeedback',
    ]);
  });

  it('omits a queue with nothing in it', () => {
    // A list of noughts is noise on a card whose job is to say what needs doing.
    const attention = toAttention(
      counts({ overdueProjects: 2, internalReview: 1 }),
    );

    expect(attention.items.map((item) => item.key)).toEqual([
      'overdueProjects',
      'internalReview',
    ]);
  });

  it('omits pending leave entirely when the caller may not review it', () => {
    // Null, not zero: a project manager cannot approve leave, so offering them
    // the number would offer work they cannot do. A client that could tell null
    // from absent would learn the queue exists.
    const attention = toAttention(
      counts({ pendingLeaveRequests: null, overdueProjects: 1 }),
    );

    expect(
      attention.items.some((item) => item.key === 'pendingLeaveRequests'),
    ).toBe(false);
  });

  it('includes pending leave when the caller may review it', () => {
    const attention = toAttention(counts({ pendingLeaveRequests: 4 }));

    expect(attention.items).toEqual([
      {
        key: 'pendingLeaveRequests',
        label: 'Leave to approve',
        count: 4,
        tone: {
          value: 'waiting',
          label: 'Waiting on a decision',
          tone: 'warning',
        },
      },
    ]);
  });

  it('reads an overdue project as danger and internal review as neutral', () => {
    // A project past its deadline is not the same kind of waiting as one moving
    // through the lifecycle, and which is the red row is a judgment about the
    // business rather than a styling choice.
    const attention = toAttention(
      counts({ overdueProjects: 1, internalReview: 1 }),
    );

    expect(attention.items[0].tone).toEqual({
      value: 'overdue',
      label: 'Past due',
      tone: 'danger',
    });
    expect(attention.items[1].tone).toEqual({
      value: 'routine',
      label: 'Moving normally',
      tone: 'default',
    });
  });

  it('reads a project stuck in planning as a warning', () => {
    const attention = toAttention(counts({ notReadyToStart: 3 }));

    expect(attention.items[0].tone.tone).toBe('warning');
  });

  it('totals only the queues it returned', () => {
    // Not the raw counts: a queue the caller may not act on is not part of what
    // is waiting on them.
    const attention = toAttention(
      counts({
        overdueProjects: 2,
        internalReview: 3,
        pendingLeaveRequests: null,
      }),
    );

    expect(attention.total).toBe(5);
    expect(attention.totalLabel).toBe('5 waiting');
  });

  it('returns an empty list and a zero total when nothing is waiting', () => {
    const attention = toAttention(counts());

    expect(attention).toEqual({
      total: 0,
      totalLabel: '0 waiting',
      items: [],
    });
  });

  it('labels every queue it emits', () => {
    // A row with no wording renders as a blank line rather than failing loudly.
    const attention = toAttention(
      counts({
        overdueProjects: 1,
        pendingRequirements: 1,
        pendingLeaveRequests: 1,
        notReadyToStart: 1,
        internalReview: 1,
        awaitingClientFeedback: 1,
      }),
    );

    expect(attention.items).toHaveLength(6);
    expect(attention.items.every((item) => item.label.trim().length > 0)).toBe(
      true,
    );
  });
});

describe('toBreakdown', () => {
  it('returns the enum declared order, not descending by count', () => {
    // Sorting by count reorders the board every time a project moves, so a
    // reader can never learn where to look.
    const result = toBreakdown({
      label: 'Projects by status',
      unit: 'projects',
      display: PROJECT_STATUS_DISPLAY,
      counts: new Map([
        [ProjectStatus.COMPLETED, 9],
        [ProjectStatus.PLANNING, 1],
        [ProjectStatus.IN_PROGRESS, 4],
      ]),
    });

    expect(result.slices.map((s) => s.key.value)).toEqual([
      'PLANNING',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
  });

  it('computes shares that sum to the whole', () => {
    // Computed once here, so slices always sum to the same 100%. A client
    // dividing by a total it also received would round differently from every
    // other client.
    const result = toBreakdown({
      label: 'Blockers by severity',
      unit: 'blockers',
      display: BLOCKER_SEVERITY_DISPLAY,
      counts: new Map([
        [BlockerSeverity.HIGH, 1],
        [BlockerSeverity.LOW, 3],
      ]),
    });

    expect(result.total).toBe(4);
    expect(result.totalLabel).toBe('4 blockers');
    expect(result.slices.map((s) => s.share).reduce((a, b) => a + b, 0)).toBe(
      1,
    );
  });

  it('omits keys with no rows', () => {
    const result = toBreakdown({
      label: 'Projects by status',
      unit: 'projects',
      display: PROJECT_STATUS_DISPLAY,
      counts: new Map([[ProjectStatus.PLANNING, 2]]),
    });

    expect(result.slices).toHaveLength(1);
    expect(result.slices[0].shareLabel).toBe('100%');
  });

  it('returns an empty breakdown when nothing is counted', () => {
    const result = toBreakdown({
      label: 'Projects by status',
      unit: 'projects',
      display: PROJECT_STATUS_DISPLAY,
      counts: new Map(),
    });

    expect(result.total).toBe(0);
    expect(result.slices).toEqual([]);
  });
});

describe('toRankedRow', () => {
  it('computes the row share of the list total, for its bar', () => {
    const row = toRankedRow({
      id: 'p1',
      name: 'Acme',
      minutes: 300,
      previousMinutes: 200,
      listTotal: 1000,
    });

    expect(row.share).toBe(0.3);
    expect(row.valueLabel).toBe('5h');
    expect(row.changeLabel).toBe('+50%');
  });

  it('never divides by a zero list total', () => {
    expect(
      toRankedRow({
        id: 'p1',
        name: 'Acme',
        minutes: 0,
        previousMinutes: null,
        listTotal: 0,
      }).share,
    ).toBe(0);
  });

  it('reads as steady whichever way the hours moved', () => {
    // More hours on a project is neither good nor bad on its own, so a rise is
    // never coloured as a problem here.
    expect(
      toRankedRow({
        id: 'p1',
        name: 'Acme',
        minutes: 600,
        previousMinutes: 100,
        listTotal: 600,
      }).tone.tone,
    ).toBe('default');
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

// ══════════════════════════════════════════════════════════════════════════
// The board
// ══════════════════════════════════════════════════════════════════════════

describe('toProjectBoard', () => {
  type Row = { id: string; status: ProjectStatus };

  const row = (id: string, status: ProjectStatus): Row => ({ id, status });

  /**
   * A stand-in card, so these cases test the GROUPING rather than the mapper
   * they delegate to. `toDashboardProject` has its own eleven cases above.
   */
  const toCard = (r: Row) =>
    ({ id: r.id }) as unknown as ReturnType<typeof toDashboardProject>;

  const build = (
    rows: Row[],
    statusTotals: Map<ProjectStatus, number>,
    perColumn = 4,
  ) => toProjectBoard({ rows, statusTotals, perColumn, toCard });

  const column = (board: ReturnType<typeof build>, phase: string) =>
    board.columns.find((c) => c.phase.value === phase);

  it('returns all four phases in lifecycle order, empty ones included', () => {
    const board = build([], new Map());

    // A board that drops its empty columns changes shape as work moves through
    // it, and a reader loses the place they learned to look.
    expect(board.columns.map((c) => c.phase.value)).toEqual([
      'TO_DO',
      'IN_PROGRESS',
      'IN_REVIEW',
      'CLOSED',
    ]);
    expect(board.columns.every((c) => c.projects.length === 0)).toBe(true);
  });

  it('files each row under the phase its status belongs to', () => {
    const board = build(
      [
        row('a', ProjectStatus.PLANNING),
        row('b', ProjectStatus.ON_HOLD),
        row('c', ProjectStatus.WAITING_FOR_FEEDBACK),
        row('d', ProjectStatus.CANCELLED),
      ],
      new Map(),
    );

    expect(column(board, 'TO_DO')?.projects.map((p) => p.id)).toEqual(['a']);
    expect(column(board, 'IN_PROGRESS')?.projects.map((p) => p.id)).toEqual([
      'b',
    ]);
    expect(column(board, 'IN_REVIEW')?.projects.map((p) => p.id)).toEqual([
      'c',
    ]);
    expect(column(board, 'CLOSED')?.projects.map((p) => p.id)).toEqual(['d']);
  });

  it('preserves the order it was given inside a column', () => {
    // It must not sort. The caller ordered the whole list once, and a column
    // re-sorting its slice would disagree with every other reading of the same
    // rows.
    const board = build(
      [
        row('third', ProjectStatus.IN_PROGRESS),
        row('first', ProjectStatus.ON_HOLD),
        row('second', ProjectStatus.IN_PROGRESS),
      ],
      new Map(),
    );

    expect(column(board, 'IN_PROGRESS')?.projects.map((p) => p.id)).toEqual([
      'third',
      'first',
      'second',
    ]);
  });

  it('counts the phase total from the status totals, not from the cards', () => {
    // The whole reason both exist. Two cards on the board, nineteen projects in
    // the lane, and the header must say nineteen.
    const board = build(
      [row('a', ProjectStatus.PLANNING), row('b', ProjectStatus.SCHEDULED)],
      new Map([
        [ProjectStatus.PLANNING, 11],
        [ProjectStatus.SCHEDULED, 5],
        [ProjectStatus.READY_FOR_WORK, 3],
      ]),
    );

    const todo = column(board, 'TO_DO');
    expect(todo?.total).toBe(19);
    expect(todo?.totalLabel).toBe('19 projects');
    expect(todo?.projects).toHaveLength(2);
    expect(todo?.hiddenCount).toBe(17);
    expect(todo?.hiddenLabel).toBe('17 more');
  });

  it('caps the cards per column and reports the rest as hidden', () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      row(`p${i}`, ProjectStatus.IN_PROGRESS),
    );
    const board = build(rows, new Map([[ProjectStatus.IN_PROGRESS, 9]]), 4);

    const inProgress = column(board, 'IN_PROGRESS');
    expect(inProgress?.projects.map((p) => p.id)).toEqual([
      'p0',
      'p1',
      'p2',
      'p3',
    ]);
    expect(inProgress?.hiddenCount).toBe(5);
  });

  it('says nothing is hidden when the column shows everything it counted', () => {
    const board = build(
      [row('a', ProjectStatus.COMPLETED)],
      new Map([[ProjectStatus.COMPLETED, 1]]),
    );

    const closed = column(board, 'CLOSED');
    expect(closed?.hiddenCount).toBe(0);
    // Null rather than "0 more", which is how a client knows not to render the
    // overflow link at all.
    expect(closed?.hiddenLabel).toBeNull();
  });

  it('says "1 project", not "1 projects"', () => {
    const board = build([], new Map([[ProjectStatus.PLANNING, 1]]));

    expect(column(board, 'TO_DO')?.totalLabel).toBe('1 project');
  });

  it('never reports a negative hidden count', () => {
    // A total and the rows it was counted from are read in the same wave but
    // not in the same transaction. A "-2 more" link is worse than none.
    const board = build(
      [
        row('a', ProjectStatus.IN_PROGRESS),
        row('b', ProjectStatus.IN_PROGRESS),
        row('c', ProjectStatus.IN_PROGRESS),
      ],
      new Map([[ProjectStatus.IN_PROGRESS, 1]]),
    );

    expect(column(board, 'IN_PROGRESS')?.hiddenCount).toBe(0);
    expect(column(board, 'IN_PROGRESS')?.hiddenLabel).toBeNull();
  });

  it('totals the board from the same counts its columns used', () => {
    const board = build(
      [row('a', ProjectStatus.PLANNING)],
      new Map([
        [ProjectStatus.PLANNING, 4],
        [ProjectStatus.IN_PROGRESS, 6],
        [ProjectStatus.COMPLETED, 2],
      ]),
    );

    expect(board.total).toBe(12);
    expect(board.columns.reduce((sum, c) => sum + c.total, 0)).toBe(
      board.total,
    );
  });

  it('carries the phase label and tone for the column header', () => {
    const board = build([], new Map());

    expect(column(board, 'IN_REVIEW')?.phase).toEqual({
      value: 'IN_REVIEW',
      label: 'In review',
      tone: 'warning',
    });
  });
});
