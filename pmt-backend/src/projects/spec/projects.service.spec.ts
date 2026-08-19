/**
 * Unit tests for the project status, archive and restore paths.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * The pure helpers in this service are covered separately by
 * project-status-transitions.spec.ts, project-dashboard-sort.spec.ts and
 * project-hours.spec.ts. This file covers the guards around them: who may make
 * a move, which moves require a reason, and how archive and restore interact
 * with the state machine without being part of it.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectStatus, Role } from '@prisma/client';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SlackService } from '@/slack/slack.service';
import { SlackUserResolverService } from '@/slack/slack-user-resolver.service';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { ProjectScopeService } from '@/project-scope/project-scope.service';
import { PermissionsService } from '@/auth/permissions.service';
import { ProjectsService } from '../projects.service';

const PROJECT_ID = 'project-1';
const PM_ID = 'pm-1';
const DEV_ID = 'dev-1';

describe('ProjectsService: status, archive and restore', () => {
  let service: ProjectsService;
  let prisma: any;
  let projectActivity: { log: jest.Mock };

  function setProject(overrides: Record<string, unknown> = {}) {
    const project = {
      id: PROJECT_ID,
      status: ProjectStatus.IN_PROGRESS,
      archivedAt: null,
      completedAt: null,
      cancellationReason: null,
      onHoldReason: null,
      clientId: 'client-1',
      slackChannelId: null,
      estimatedHours: null,
      actualHours: 0,
      ...overrides,
    };
    prisma.project.findUnique.mockResolvedValue(project);
    prisma.project.findFirst.mockResolvedValue(project);
    return project;
  }

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ id: PROJECT_ID, ...data, projectTypeTags: [] }),
          ),
        create: jest.fn(),
      },
      projectMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      projectTypeTag: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    projectActivity = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        ProjectScopeService,
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectActivityService, useValue: projectActivity },
        {
          provide: SlackService,
          useValue: {
            postMessage: jest.fn(),
            createProjectChannel: jest.fn(),
            inviteToChannel: jest.fn(),
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
            resolveAllActiveMembersAndAdminIds: jest.fn().mockResolvedValue([]),
            resolveManagingPmAndAdminIds: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(ProjectsService);
    setProject();
  });

  afterEach(() => jest.clearAllMocks());

  describe('updateStatus: the transition must be in the table', () => {
    it('rejects a move the table does not allow, with 409', async () => {
      setProject({ status: ProjectStatus.PLANNING });
      await expect(
        service.updateStatus(
          PROJECT_ID,
          { status: ProjectStatus.COMPLETED },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows a move the table does allow', async () => {
      setProject({ status: ProjectStatus.IN_PROGRESS });
      await expect(
        service.updateStatus(
          PROJECT_ID,
          { status: ProjectStatus.INTERNAL_REVIEW },
          PM_ID,
          Role.ADMIN,
        ),
      ).resolves.toBeDefined();
    });

    it('throws 404 for a project that does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(
        service.updateStatus(
          'ghost',
          { status: ProjectStatus.ON_HOLD },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateStatus: CANCELLED is admin only and needs a reason', () => {
    beforeEach(() => setProject({ status: ProjectStatus.IN_PROGRESS }));

    it.each([Role.PROJECT_MANAGER, Role.DEVELOPER, Role.DESIGNER])(
      'rejects a %s cancelling a project',
      async (role) => {
        await expect(
          service.updateStatus(
            PROJECT_ID,
            { status: ProjectStatus.CANCELLED, reason: 'x' },
            PM_ID,
            role,
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it('requires a reason even for an ADMIN', async () => {
      await expect(
        service.updateStatus(
          PROJECT_ID,
          { status: ProjectStatus.CANCELLED },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores the reason as cancellationReason', async () => {
      await service.updateStatus(
        PROJECT_ID,
        { status: ProjectStatus.CANCELLED, reason: 'Client withdrew' },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancellationReason: 'Client withdrew',
          }),
        }),
      );
    });
  });

  describe('updateStatus: ON_HOLD excludes developers and needs a reason', () => {
    beforeEach(() => setProject({ status: ProjectStatus.IN_PROGRESS }));

    it.each([Role.DEVELOPER, Role.DESIGNER])(
      'rejects a %s moving a project ON_HOLD',
      async (role) => {
        // Developers and designers can change status through this endpoint
        // generally, but not this one specific transition.
        await expect(
          service.updateStatus(
            PROJECT_ID,
            { status: ProjectStatus.ON_HOLD, reason: 'x' },
            DEV_ID,
            role,
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it('allows a PROJECT_MANAGER with a reason', async () => {
      await expect(
        service.updateStatus(
          PROJECT_ID,
          { status: ProjectStatus.ON_HOLD, reason: 'Awaiting assets' },
          PM_ID,
          Role.PROJECT_MANAGER,
        ),
      ).resolves.toBeDefined();
    });

    it('requires a reason', async () => {
      await expect(
        service.updateStatus(
          PROJECT_ID,
          { status: ProjectStatus.ON_HOLD },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateStatus: COMPLETED is not reachable through this endpoint', () => {
    it('rejects WAITING_FOR_FEEDBACK to COMPLETED, even for an ADMIN', async () => {
      // Deliberate. Only ClientFeedbackService.create()'s first round may
      // complete a project, so a ClientFeedback row always exists to explain
      // how it left WAITING_FOR_FEEDBACK. If this test starts failing, someone
      // has widened the table and broken that guarantee.
      setProject({ status: ProjectStatus.WAITING_FOR_FEEDBACK });
      await expect(
        service.updateStatus(
          PROJECT_ID,
          { status: ProjectStatus.COMPLETED },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects INTERNAL_REVIEW to READY_FOR_CLIENT, for the same reason', async () => {
      // Only InternalReviewsService.create() may make that move.
      setProject({ status: ProjectStatus.INTERNAL_REVIEW });
      await expect(
        service.updateStatus(
          PROJECT_ID,
          { status: ProjectStatus.READY_FOR_CLIENT },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateStatus: reopening a closed project', () => {
    it('is ADMIN only', async () => {
      setProject({ status: ProjectStatus.COMPLETED });
      await expect(
        service.updateStatus(
          PROJECT_ID,
          { status: ProjectStatus.READY_FOR_WORK },
          PM_ID,
          Role.PROJECT_MANAGER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('clears completedAt and cancellationReason on the way back', async () => {
      setProject({
        status: ProjectStatus.CANCELLED,
        cancellationReason: 'was cancelled',
      });
      await service.updateStatus(
        PROJECT_ID,
        { status: ProjectStatus.READY_FOR_WORK },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completedAt: null,
            cancellationReason: null,
          }),
        }),
      );
    });

    it('refuses to reopen an ARCHIVED project, pointing at restore instead', async () => {
      setProject({ status: ProjectStatus.COMPLETED, archivedAt: new Date() });
      await expect(
        service.updateStatus(
          PROJECT_ID,
          { status: ProjectStatus.READY_FOR_WORK },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toThrow(/use restore instead/i);
    });
  });

  describe('archive', () => {
    it.each([Role.PROJECT_MANAGER, Role.DEVELOPER, Role.DESIGNER, Role.CLIENT])(
      'rejects a %s',
      async (role) => {
        setProject({ status: ProjectStatus.COMPLETED });
        await expect(
          service.archive(PROJECT_ID, PM_ID, role),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it.each([
      ProjectStatus.IN_PROGRESS,
      ProjectStatus.PLANNING,
      ProjectStatus.ON_HOLD,
      ProjectStatus.READY_FOR_CLIENT,
    ])('rejects archiving a project that is %s', async (status) => {
      setProject({ status });
      await expect(
        service.archive(PROJECT_ID, PM_ID, Role.ADMIN),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it.each([ProjectStatus.COMPLETED, ProjectStatus.CANCELLED])(
      'archives a %s project',
      async (status) => {
        setProject({ status });
        await service.archive(PROJECT_ID, PM_ID, Role.ADMIN);
        expect(prisma.project.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: { archivedAt: expect.any(Date) } }),
        );
      },
    );

    it('does NOT touch status, because archive is a flag layered on top', async () => {
      setProject({ status: ProjectStatus.COMPLETED });
      await service.archive(PROJECT_ID, PM_ID, Role.ADMIN);
      const { data } = prisma.project.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('status');
    });

    it('rejects archiving twice', async () => {
      setProject({ status: ProjectStatus.COMPLETED, archivedAt: new Date() });
      await expect(
        service.archive(PROJECT_ID, PM_ID, Role.ADMIN),
      ).rejects.toThrow(/already archived/i);
    });
  });

  describe('restore', () => {
    it('is ADMIN only', async () => {
      setProject({ status: ProjectStatus.COMPLETED, archivedAt: new Date() });
      await expect(
        service.restore(PROJECT_ID, PM_ID, Role.PROJECT_MANAGER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects restoring a project that is not archived', async () => {
      setProject({ status: ProjectStatus.COMPLETED, archivedAt: null });
      await expect(
        service.restore(PROJECT_ID, PM_ID, Role.ADMIN),
      ).rejects.toThrow(/not archived/i);
    });

    it('always returns to READY_FOR_WORK, whichever closed status it had', async () => {
      for (const status of [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED]) {
        jest.clearAllMocks();
        setProject({ status, archivedAt: new Date() });
        await service.restore(PROJECT_ID, PM_ID, Role.ADMIN);
        expect(prisma.project.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              archivedAt: null,
              status: ProjectStatus.READY_FOR_WORK,
              completedAt: null,
              cancellationReason: null,
            }),
          }),
        );
      }
    });

    it('logs PROJECT_RESTORED', async () => {
      setProject({ status: ProjectStatus.COMPLETED, archivedAt: new Date() });
      await service.restore(PROJECT_ID, PM_ID, Role.ADMIN);
      expect(projectActivity.log).toHaveBeenCalledWith(
        PROJECT_ID,
        PM_ID,
        'PROJECT_RESTORED',
      );
    });
  });
});
