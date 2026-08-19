import { Permission, ProjectPriority, ProjectStatus } from '@prisma/client';

import {
  buildProjectCapabilities,
  daysUntilDeadline,
  toProjectResponse,
} from '../project.mapper';

const NOW = new Date('2026-08-19T12:00:00.000Z');

const ALL_PERMISSIONS = [
  Permission.EDIT_PROJECT,
  Permission.CHANGE_PROJECT_STATUS,
  Permission.CHANGE_PROJECT_PRIORITY,
  Permission.MANAGE_PROJECT_TYPES,
  Permission.MANAGE_ESTIMATED_HOURS,
  Permission.ARCHIVE_PROJECT,
  Permission.CONNECT_PROJECT_SLACK,
  Permission.MANAGE_PROJECT_MEMBERS,
  Permission.MANAGE_PROJECT_DOCUMENTS,
];

const MANAGER = { permissions: ALL_PERMISSIONS, managesProject: true };

function project(overrides: Record<string, unknown> = {}) {
  return {
    status: ProjectStatus.IN_PROGRESS,
    priority: ProjectPriority.HIGH,
    archivedAt: null,
    deadline: new Date('2026-09-30T00:00:00.000Z'),
    estimatedHours: 120,
    actualHours: 47.5,
    ...overrides,
  };
}

describe('daysUntilDeadline', () => {
  it('counts whole days forward', () => {
    expect(daysUntilDeadline(new Date('2026-08-21T00:00:00.000Z'), NOW)).toBe(
      2,
    );
  });

  it('is zero on the deadline day itself, whatever the time', () => {
    // Compared at day granularity, so a deadline "today" does not read as
    // already missed just because it is stamped at midnight.
    expect(daysUntilDeadline(new Date('2026-08-19T00:00:00.000Z'), NOW)).toBe(
      0,
    );
    expect(daysUntilDeadline(new Date('2026-08-19T23:59:00.000Z'), NOW)).toBe(
      0,
    );
  });

  it('goes negative once passed', () => {
    expect(daysUntilDeadline(new Date('2026-08-14T00:00:00.000Z'), NOW)).toBe(
      -5,
    );
  });

  it('is null with no deadline', () => {
    expect(daysUntilDeadline(null, NOW)).toBeNull();
  });
});

describe('toProjectResponse', () => {
  it('returns status and priority as display objects', () => {
    const result = toProjectResponse(project(), MANAGER, NOW);
    expect(result.status).toEqual({
      value: 'IN_PROGRESS',
      label: 'In progress',
      tone: 'primary',
    });
    expect(result.priority).toEqual({
      value: 'HIGH',
      label: 'High',
      tone: 'warning',
    });
  });

  describe('remainingHours', () => {
    it('is estimated minus actual', () => {
      expect(toProjectResponse(project(), MANAGER, NOW).remainingHours).toBe(
        72.5,
      );
    });

    it('is null with no estimate, which differs from nothing remaining', () => {
      expect(
        toProjectResponse(project({ estimatedHours: null }), MANAGER, NOW)
          .remainingHours,
      ).toBeNull();
    });

    it('goes negative on overrun rather than clamping to zero', () => {
      // Clamping would hide the overrun, which is the number a manager needs.
      expect(
        toProjectResponse(
          project({ estimatedHours: 40, actualHours: 47.5 }),
          MANAGER,
          NOW,
        ).remainingHours,
      ).toBe(-7.5);
    });
  });

  describe('isOverdue', () => {
    it('is true for live work past its deadline', () => {
      const late = project({ deadline: new Date('2026-08-01T00:00:00.000Z') });
      expect(toProjectResponse(late, MANAGER, NOW).isOverdue).toBe(true);
    });

    it('is false for a COMPLETED project past its deadline', () => {
      // A finished project is not overdue, it is finished. A raw date
      // comparison in a client loses exactly this distinction.
      const done = project({
        deadline: new Date('2026-08-01T00:00:00.000Z'),
        status: ProjectStatus.COMPLETED,
      });
      const result = toProjectResponse(done, MANAGER, NOW);
      expect(result.isOverdue).toBe(false);
      expect(result.isTerminal).toBe(true);
      // The day count is still reported: it is a fact either way.
      expect(result.daysUntilDeadline).toBe(-18);
    });

    it('is false for a CANCELLED project past its deadline', () => {
      const cancelled = project({
        deadline: new Date('2026-08-01T00:00:00.000Z'),
        status: ProjectStatus.CANCELLED,
      });
      expect(toProjectResponse(cancelled, MANAGER, NOW).isOverdue).toBe(false);
    });

    it('is false with no deadline at all', () => {
      expect(
        toProjectResponse(project({ deadline: null }), MANAGER, NOW).isOverdue,
      ).toBe(false);
    });
  });
});

describe('buildProjectCapabilities', () => {
  it('grants everything to a manager of a live project, except restore', () => {
    const caps = buildProjectCapabilities(
      { status: ProjectStatus.IN_PROGRESS, archivedAt: null },
      MANAGER,
    );
    expect(caps.canEdit).toBe(true);
    expect(caps.canArchive).toBe(true);
    // Restoring a project that is not archived is meaningless.
    expect(caps.canRestore).toBe(false);
  });

  it('flips archive and restore once archived, never both at once', () => {
    const caps = buildProjectCapabilities(
      { status: ProjectStatus.IN_PROGRESS, archivedAt: new Date() },
      MANAGER,
    );
    expect(caps.canArchive).toBe(false);
    expect(caps.canRestore).toBe(true);
  });

  it('closes every edit on an archived project', () => {
    const caps = buildProjectCapabilities(
      { status: ProjectStatus.IN_PROGRESS, archivedAt: new Date() },
      MANAGER,
    );
    for (const flag of [
      caps.canEdit,
      caps.canChangeStatus,
      caps.canChangePriority,
      caps.canManageTypes,
      caps.canManageEstimatedHours,
      caps.canConnectSlack,
      caps.canManageMembers,
      caps.canManageDocuments,
    ]) {
      expect(flag).toBe(false);
    }
  });

  it('refuses an action whose permission the caller lacks', () => {
    const caps = buildProjectCapabilities(
      { status: ProjectStatus.IN_PROGRESS, archivedAt: null },
      { permissions: [Permission.EDIT_PROJECT], managesProject: true },
    );
    expect(caps.canEdit).toBe(true);
    expect(caps.canArchive).toBe(false);
    expect(caps.canManageMembers).toBe(false);
  });

  it('refuses an action the caller has the permission for but not the project', () => {
    // The pairing a permission alone cannot express: holding EDIT_PROJECT means
    // a PROJECT_MANAGER may edit projects, not that they may edit THIS one.
    const caps = buildProjectCapabilities(
      { status: ProjectStatus.IN_PROGRESS, archivedAt: null },
      { permissions: ALL_PERMISSIONS, managesProject: false },
    );
    expect(caps.canEdit).toBe(false);
    expect(caps.canManageMembers).toBe(false);
    // Status is the deliberate exception: it is open to every active member,
    // not only the manager, so it does not require managesProject.
    expect(caps.canChangeStatus).toBe(true);
  });

  it('gives a reader with no permissions nothing at all', () => {
    const caps = buildProjectCapabilities(
      { status: ProjectStatus.IN_PROGRESS, archivedAt: null },
      { permissions: [], managesProject: false },
    );
    expect(Object.values(caps).every((flag) => flag === false)).toBe(true);
  });
});
