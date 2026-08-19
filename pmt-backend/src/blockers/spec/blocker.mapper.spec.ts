import { BlockerSeverity, BlockerStatus } from '@prisma/client';

import {
  BlockerWithRelations,
  toBlockerResponse,
} from '@/blockers/blocker.mapper';

const CREATED = new Date('2026-08-12T09:00:00.000Z');
const NOW = new Date('2026-08-12T12:00:00.000Z');

const MEMBER = { managesProject: false, isProjectMember: true };
const MANAGER = { managesProject: true, isProjectMember: false };
const OUTSIDER = { managesProject: false, isProjectMember: false };

function blocker(
  overrides: Partial<BlockerWithRelations> = {},
): BlockerWithRelations {
  return {
    id: 'b1',
    projectId: 'p1',
    description: 'DB schema not approved',
    status: BlockerStatus.OPEN,
    severity: BlockerSeverity.HIGH,
    reasonId: 'r1',
    reportedById: 'u1',
    assignedToId: null,
    assignedAt: null,
    resolvedById: null,
    resolvedAt: null,
    resolutionNotes: null,
    deadlineExtensionDays: null,
    createdAt: CREATED,
    updatedAt: CREATED,
    project: { id: 'p1', name: 'Acme corporate site', slackChannelId: null },
    reason: {
      id: 'r1',
      name: 'Technical',
      createdAt: CREATED,
      updatedAt: CREATED,
    },
    reportedBy: {
      id: 'u1',
      name: 'Rezina Akter',
      email: 'rezina@pixelvega.com',
    },
    assignedTo: null,
    resolvedBy: null,
    ...overrides,
  };
}

describe('toBlockerResponse', () => {
  it('returns status and severity as display objects', () => {
    const result = toBlockerResponse(blocker(), MEMBER, NOW);
    expect(result.status).toEqual({
      value: 'OPEN',
      label: 'Open',
      tone: 'danger',
    });
    expect(result.severity).toEqual({
      value: 'HIGH',
      label: 'High',
      tone: 'danger',
    });
  });

  it('drops the Slack channel id from the project it exposes', () => {
    // It is in the include because Slack posting needs it, and it has no
    // business on a response.
    const result = toBlockerResponse(blocker(), MEMBER, NOW);
    expect(result.project).toEqual({ id: 'p1', name: 'Acme corporate site' });
  });

  describe('age and resolution time', () => {
    it('measures an open blocker to now', () => {
      const result = toBlockerResponse(blocker(), MEMBER, NOW);
      expect(result.ageMinutes).toBe(180);
      expect(result.ageLabel).toBe('3h');
      // It is not resolved, so it has no resolution time.
      expect(result.resolutionMinutes).toBeNull();
      expect(result.resolutionLabel).toBeNull();
    });

    it('measures a resolved blocker to its resolution, not to now', () => {
      // The distinction that makes the field sortable: a blocker resolved
      // yesterday must not keep ageing.
      const result = toBlockerResponse(
        blocker({
          status: BlockerStatus.RESOLVED,
          resolvedAt: new Date('2026-08-12T10:30:00.000Z'),
        }),
        MEMBER,
        NOW,
      );
      expect(result.resolutionMinutes).toBe(90);
      expect(result.resolutionLabel).toBe('1h 30m');
      expect(result.ageMinutes).toBe(90);
    });

    it('never reports a negative age', () => {
      const result = toBlockerResponse(blocker(), MEMBER, CREATED);
      expect(result.ageMinutes).toBe(0);
      expect(result.ageLabel).toBe('0m');
    });
  });

  describe('capabilities', () => {
    it('lets a project member act on an open blocker', () => {
      expect(toBlockerResponse(blocker(), MEMBER, NOW).capabilities).toEqual({
        canEdit: true,
        canChangeStatus: true,
        canResolve: true,
        canReassign: true,
      });
    });

    it('lets a manager act too', () => {
      expect(
        toBlockerResponse(blocker(), MANAGER, NOW).capabilities.canEdit,
      ).toBe(true);
    });

    it('offers nothing to someone with no connection to the project', () => {
      expect(toBlockerResponse(blocker(), OUTSIDER, NOW).capabilities).toEqual({
        canEdit: false,
        canChangeStatus: false,
        canResolve: false,
        canReassign: false,
      });
    });

    it('locks everything once resolved, even for a manager', () => {
      // A resolved blocker is permanently read only. The service rejects any
      // edit outright, so anything true here would be a button that 409s.
      const resolved = blocker({
        status: BlockerStatus.RESOLVED,
        resolvedAt: NOW,
      });
      expect(toBlockerResponse(resolved, MANAGER, NOW).capabilities).toEqual({
        canEdit: false,
        canChangeStatus: false,
        canResolve: false,
        canReassign: false,
      });
    });

    it('reports isResolved beside the status, so a client never compares strings', () => {
      expect(toBlockerResponse(blocker(), MEMBER, NOW).isResolved).toBe(false);
      expect(
        toBlockerResponse(
          blocker({ status: BlockerStatus.RESOLVED, resolvedAt: NOW }),
          MEMBER,
          NOW,
        ).isResolved,
      ).toBe(true);
    });
  });
});
