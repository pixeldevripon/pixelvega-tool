import { ProjectRole, Role } from '@prisma/client';

import {
  toProjectMemberResponse,
  ProjectMemberWithUser,
} from './project-member.mapper';

const JOINED = new Date('2026-08-01T09:00:00.000Z');

function member(
  overrides: Partial<ProjectMemberWithUser> = {},
): ProjectMemberWithUser {
  return {
    id: 'm1',
    projectId: 'p1',
    userId: 'u1',
    role: ProjectRole.DEVELOPER,
    joinedAt: JOINED,
    leftAt: null,
    createdAt: JOINED,
    updatedAt: JOINED,
    user: {
      id: 'u1',
      name: 'Rezina Akter',
      email: 'rezina@pixelvega.com',
      role: Role.DEVELOPER,
    },
    ...overrides,
  };
}

const MANAGER_WITH_SLACK = { managesProject: true, hasSlackChannel: true };

describe('toProjectMemberResponse', () => {
  it('returns both roles as display objects, not raw enums', () => {
    const result = toProjectMemberResponse(member(), MANAGER_WITH_SLACK);
    expect(result.role).toEqual({
      value: 'DEVELOPER',
      label: 'Developer',
      tone: 'default',
    });
    expect(result.user.role).toEqual({
      value: 'DEVELOPER',
      label: 'Developer',
      tone: 'default',
    });
  });

  it('distinguishes the staffing role from the global role', () => {
    // A PROJECT_MANAGER staffed as a DEVELOPER is a real case, and the two
    // fields must not be collapsed into one.
    const result = toProjectMemberResponse(
      member({
        role: ProjectRole.DEVELOPER,
        user: {
          id: 'u1',
          name: 'Rezina Akter',
          email: 'rezina@pixelvega.com',
          role: Role.PROJECT_MANAGER,
        },
      }),
      MANAGER_WITH_SLACK,
    );
    expect(result.role.value).toBe('DEVELOPER');
    expect(result.user.role.value).toBe('PROJECT_MANAGER');
  });

  describe('isActive', () => {
    it('is true while leftAt is null', () => {
      expect(
        toProjectMemberResponse(member(), MANAGER_WITH_SLACK).isActive,
      ).toBe(true);
    });

    it('is false once leftAt is set, and keeps the timestamp', () => {
      const left = new Date('2026-08-15T09:00:00.000Z');
      const result = toProjectMemberResponse(
        member({ leftAt: left }),
        MANAGER_WITH_SLACK,
      );
      expect(result.isActive).toBe(false);
      // The boolean is a convenience beside the timestamp, never a replacement:
      // a screen still shows when someone left.
      expect(result.leftAt).toBe(left);
    });
  });

  describe('capabilities', () => {
    it('grants both to a manager of an active member on a Slack connected project', () => {
      expect(
        toProjectMemberResponse(member(), MANAGER_WITH_SLACK).capabilities,
      ).toEqual({ canRemove: true, canResyncSlack: true });
    });

    it('grants neither to a caller who does not manage the project', () => {
      expect(
        toProjectMemberResponse(member(), {
          managesProject: false,
          hasSlackChannel: true,
        }).capabilities,
      ).toEqual({ canRemove: false, canResyncSlack: false });
    });

    it('withholds removal from a member who already left', () => {
      // The service answers a second removal with a 409. The flag is what stops
      // the UI offering the button that earns it.
      const result = toProjectMemberResponse(
        member({ leftAt: new Date() }),
        MANAGER_WITH_SLACK,
      );
      expect(result.capabilities.canRemove).toBe(false);
    });

    it('withholds the Slack resync when the project has no channel', () => {
      const result = toProjectMemberResponse(member(), {
        managesProject: true,
        hasSlackChannel: false,
      });
      expect(result.capabilities.canResyncSlack).toBe(false);
      // Removal is unaffected: it has nothing to do with Slack.
      expect(result.capabilities.canRemove).toBe(true);
    });
  });
});
