/**
 * Unit tests for project staffing.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * Two invariants carry the weight here: staffing is append only (removing sets
 * leftAt rather than deleting, so past rows survive), and the automatic
 * transition out of PLANNING fires exactly once, on add, and only when both
 * halves of a viable team are present.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectRole, ProjectStatus, Role } from '@prisma/client';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { SlackService } from '@/slack/slack.service';
import { SlackUserResolverService } from '@/slack/slack-user-resolver.service';
import { ProjectScopeService } from '@/project-scope/project-scope.service';
import { ProjectMembersService } from '../project-members.service';

const PROJECT_ID = 'project-1';
const PM_ID = 'pm-1';
const DEV_ID = 'dev-1';

function createMockPrisma() {
  return {
    project: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    projectMember: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
  };
}

describe('ProjectMembersService', () => {
  let service: ProjectMembersService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let projectActivity: { log: jest.Mock };

  function setProject(overrides: Record<string, unknown>) {
    const project = {
      id: PROJECT_ID,
      status: ProjectStatus.IN_PROGRESS,
      plannedStartDate: null,
      slackChannelId: null,
      ...overrides,
    };
    prisma.project.findUnique.mockResolvedValue(project);
    prisma.project.findFirst.mockResolvedValue(project);
  }

  beforeEach(async () => {
    prisma = createMockPrisma();
    projectActivity = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectScopeService,
        ProjectMembersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectActivityService, useValue: projectActivity },
        {
          provide: SlackService,
          useValue: {
            inviteToChannel: jest.fn(),
            removeFromChannel: jest.fn(),
          },
        },
        {
          provide: SlackUserResolverService,
          useValue: { resolveSlackUserId: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: NotificationsService,
          useValue: {
            notify: jest.fn(),
            resolveManagingPmAndAdminIds: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(ProjectMembersService);

    // getProjectOrThrow uses findUnique; set both so the helper below can
    // switch the project's state through a single call.
    setProject({ status: ProjectStatus.IN_PROGRESS, plannedStartDate: null });
    prisma.user.findFirst.mockResolvedValue({
      id: DEV_ID,
      role: Role.DEVELOPER,
      name: 'Dev',
    });
    prisma.projectMember.findFirst.mockResolvedValue(null);
    prisma.projectMember.create.mockImplementation(
      ({ data }: { data: object }) =>
        Promise.resolve({
          id: 'member-1',
          ...data,
          user: { id: DEV_ID, name: 'Dev' },
        }),
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('add: the ProjectRole must match the user global Role', () => {
    it.each([
      [ProjectRole.DEVELOPER, Role.DESIGNER],
      [ProjectRole.DESIGNER, Role.DEVELOPER],
      [ProjectRole.PROJECT_MANAGER, Role.DEVELOPER],
      [ProjectRole.DEVELOPER, Role.CLIENT],
      [ProjectRole.DEVELOPER, Role.ADMIN],
    ])(
      'rejects staffing as %s a user whose global role is %s',
      async (projectRole, globalRole) => {
        // Role is the source of truth; ProjectRole only narrows it to the
        // staffing context. Allowing a mismatch would let a CLIENT be staffed as
        // a developer and reach every internal surface on the project.
        prisma.user.findFirst.mockResolvedValue({
          id: DEV_ID,
          role: globalRole,
          name: 'X',
        });
        await expect(
          service.add(
            PROJECT_ID,
            { userId: DEV_ID, role: projectRole },
            PM_ID,
            Role.ADMIN,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it.each([
      [ProjectRole.DEVELOPER, Role.DEVELOPER],
      [ProjectRole.DESIGNER, Role.DESIGNER],
      [ProjectRole.PROJECT_MANAGER, Role.PROJECT_MANAGER],
    ])(
      'accepts %s for a user whose global role is %s',
      async (projectRole, globalRole) => {
        prisma.user.findFirst.mockResolvedValue({
          id: DEV_ID,
          role: globalRole,
          name: 'X',
        });
        await expect(
          service.add(
            PROJECT_ID,
            { userId: DEV_ID, role: projectRole },
            PM_ID,
            Role.ADMIN,
          ),
        ).resolves.toBeDefined();
      },
    );

    it('throws 404 for a user that does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.add(
          PROJECT_ID,
          { userId: 'ghost', role: ProjectRole.DEVELOPER },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('add: the duplicate guard is scoped to (project, user, role)', () => {
    it('rejects the same user holding the same role twice concurrently', async () => {
      prisma.projectMember.findFirst.mockResolvedValue({
        id: 'existing',
        leftAt: null,
      });
      await expect(
        service.add(
          PROJECT_ID,
          { userId: DEV_ID, role: ProjectRole.DEVELOPER },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('scopes the check by user AND role, not by role alone', async () => {
      // A project may have any number of different developers at once. A guard
      // keyed on (project, role) would allow only one, which is wrong.
      await service.add(
        PROJECT_ID,
        { userId: DEV_ID, role: ProjectRole.DEVELOPER },
        PM_ID,
        Role.ADMIN,
      );
      const guard = prisma.projectMember.findFirst.mock.calls[0][0];
      expect(guard.where).toMatchObject({
        projectId: PROJECT_ID,
        userId: DEV_ID,
        role: ProjectRole.DEVELOPER,
        leftAt: null,
      });
    });
  });

  describe('add: automatic transition out of PLANNING', () => {
    function planningProject(plannedStartDate: Date | null) {
      setProject({ status: ProjectStatus.PLANNING, plannedStartDate });
    }

    it('does nothing while only one half of the team is staffed', async () => {
      planningProject(null);
      // A PM exists, but no developer or designer yet.
      prisma.projectMember.findFirst.mockImplementation(({ where }: any) => {
        if (where?.role?.in?.includes(ProjectRole.PROJECT_MANAGER))
          return Promise.resolve({ id: 'pm' });
        return Promise.resolve(null);
      });
      await service.add(
        PROJECT_ID,
        { userId: DEV_ID, role: ProjectRole.DEVELOPER },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('moves to READY_FOR_WORK once both halves exist and there is no future start date', async () => {
      planningProject(null);
      prisma.projectMember.findFirst.mockImplementation(({ where }: any) =>
        where?.role?.in
          ? Promise.resolve({ id: 'someone' })
          : Promise.resolve(null),
      );
      await service.add(
        PROJECT_ID,
        { userId: DEV_ID, role: ProjectRole.DEVELOPER },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ProjectStatus.READY_FOR_WORK },
        }),
      );
    });

    it('moves to SCHEDULED instead when the planned start is in the future', async () => {
      planningProject(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      prisma.projectMember.findFirst.mockImplementation(({ where }: any) =>
        where?.role?.in
          ? Promise.resolve({ id: 'someone' })
          : Promise.resolve(null),
      );
      await service.add(
        PROJECT_ID,
        { userId: DEV_ID, role: ProjectRole.DEVELOPER },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ProjectStatus.SCHEDULED } }),
      );
    });

    it('treats a past planned start as ready now, not scheduled', async () => {
      planningProject(new Date(Date.now() - 24 * 60 * 60 * 1000));
      prisma.projectMember.findFirst.mockImplementation(({ where }: any) =>
        where?.role?.in
          ? Promise.resolve({ id: 'someone' })
          : Promise.resolve(null),
      );
      await service.add(
        PROJECT_ID,
        { userId: DEV_ID, role: ProjectRole.DEVELOPER },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ProjectStatus.READY_FOR_WORK },
        }),
      );
    });

    it('never fires for a project that has already left PLANNING', async () => {
      // The transition is one way and one time. A member joining an
      // IN_PROGRESS project must not reset its status.
      setProject({ status: ProjectStatus.IN_PROGRESS, plannedStartDate: null });
      prisma.projectMember.findFirst.mockImplementation(({ where }: any) =>
        where?.role?.in
          ? Promise.resolve({ id: 'someone' })
          : Promise.resolve(null),
      );
      await service.add(
        PROJECT_ID,
        { userId: DEV_ID, role: ProjectRole.DEVELOPER },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });
  });

  describe('remove: staffing history is append only', () => {
    beforeEach(() => {
      prisma.projectMember.findFirst.mockResolvedValue({
        id: 'member-1',
        projectId: PROJECT_ID,
        userId: DEV_ID,
        role: ProjectRole.DEVELOPER,
        leftAt: null,
        user: { id: DEV_ID, name: 'Dev' },
      });
      prisma.projectMember.update.mockResolvedValue({
        id: 'member-1',
        leftAt: new Date(),
        user: { id: DEV_ID, name: 'Dev' },
      });
    });

    it('sets leftAt rather than deleting the row', async () => {
      await service.remove(PROJECT_ID, 'member-1', PM_ID, Role.ADMIN);
      expect(prisma.projectMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'member-1' },
          data: expect.objectContaining({ leftAt: expect.any(Date) }),
        }),
      );
    });

    it('rejects removing a member who has already left', async () => {
      prisma.projectMember.findFirst.mockResolvedValue({
        id: 'member-1',
        leftAt: new Date('2026-01-01'),
        user: { id: DEV_ID, name: 'Dev' },
      });
      await expect(
        service.remove(PROJECT_ID, 'member-1', PM_ID, Role.ADMIN),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws 404 for a member row that does not exist', async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.remove(PROJECT_ID, 'ghost', PM_ID, Role.ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does NOT revert the project status when the last member leaves', async () => {
      // The automatic transition fires only on add. A member leaving never
      // moves a project back to PLANNING.
      await service.remove(PROJECT_ID, 'member-1', PM_ID, Role.ADMIN);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });
  });
});
