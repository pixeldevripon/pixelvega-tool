/**
 * Unit tests for the blocker lifecycle.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * Three invariants: RESOLVED is permanently locked with no admin override,
 * status moves forward only (though they may skip IN_PROGRESS), and the two
 * resolve-only fields are rejected unless the move is actually a resolve.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BlockerStatus, Role } from '@prisma/client';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/projects/project-activity.service';
import { SlackService } from '@/slack/slack.service';
import { BlockerService } from './blocker.service';

const BLOCKER_ID = 'blocker-1';
const PROJECT_ID = 'project-1';
const REPORTER_ID = 'dev-1';
const OTHER_DEV_ID = 'dev-2';
const PM_ID = 'pm-1';

function blocker(overrides: Record<string, unknown> = {}) {
  return {
    id: BLOCKER_ID,
    projectId: PROJECT_ID,
    reportedById: REPORTER_ID,
    assignedToId: null,
    status: BlockerStatus.OPEN,
    severity: 'MEDIUM',
    description: 'Waiting on API keys',
    createdAt: new Date('2026-06-01'),
    resolvedAt: null,
    project: { id: PROJECT_ID, slackChannelId: null, deadline: null },
    reportedBy: { id: REPORTER_ID, name: 'Dev One' },
    ...overrides,
  };
}

describe('BlockerService: the update lifecycle', () => {
  let service: BlockerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      blocker: {
        findUnique: jest.fn().mockResolvedValue(blocker()),
        findFirst: jest.fn().mockResolvedValue(blocker()),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ ...blocker(), ...data }),
          ),
      },
      blockerReason: {
        findFirst: jest.fn().mockResolvedValue({ id: 'reason-1' }),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: PROJECT_ID,
          deadline: null,
          slackChannelId: null,
        }),
        // Read when a resolve carries deadlineExtensionDays, to apply the
        // extension additively onto the current deadline.
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: PROJECT_ID,
          deadline: new Date('2026-09-01'),
          slackChannelId: null,
        }),
        update: jest.fn().mockResolvedValue({ id: PROJECT_ID }),
      },
      projectMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // Read when a status change assigns the actor as the current owner.
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: REPORTER_ID,
          name: 'Dev One',
          role: Role.DEVELOPER,
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: REPORTER_ID,
          name: 'Dev One',
          role: Role.DEVELOPER,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: REPORTER_ID,
          name: 'Dev One',
          role: Role.DEVELOPER,
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectActivityService, useValue: { log: jest.fn() } },
        { provide: SlackService, useValue: { postMessage: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: {
            notify: jest.fn(),
            resolveManagingPmAndAdminIds: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(BlockerService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('RESOLVED is permanently locked', () => {
    beforeEach(() => {
      prisma.blocker.findUnique.mockResolvedValue(
        blocker({ status: BlockerStatus.RESOLVED, resolvedAt: new Date() }),
      );
    });

    it('rejects any further edit with 409', async () => {
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { description: 'edited' },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects the edit even for an ADMIN', async () => {
      // The one terminal lock in this module with no override at all. A
      // resolved blocker is an audit record.
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { description: 'edited' },
          'admin-1',
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('checks the lock BEFORE the permission check', async () => {
      // Even someone with no right to edit gets told it is resolved, which is
      // the more useful message and leaks nothing.
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { description: 'x' },
          OTHER_DEV_ID,
          Role.DEVELOPER,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('status moves forward only', () => {
    it('allows OPEN to IN_PROGRESS', async () => {
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { status: BlockerStatus.IN_PROGRESS },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).resolves.toBeDefined();
    });

    it('allows OPEN straight to RESOLVED, skipping IN_PROGRESS', async () => {
      // A blocker can be resolved before anyone marks it in progress.
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { status: BlockerStatus.RESOLVED, resolutionNotes: 'Keys arrived' },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).resolves.toBeDefined();
    });

    it('rejects IN_PROGRESS back to OPEN', async () => {
      prisma.blocker.findUnique.mockResolvedValue(
        blocker({ status: BlockerStatus.IN_PROGRESS }),
      );
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { status: BlockerStatus.OPEN },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('resolve only fields', () => {
    it('requires resolutionNotes when resolving', async () => {
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { status: BlockerStatus.RESOLVED },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).rejects.toThrow(/resolutionNotes is required/i);
    });

    it('rejects resolutionNotes sent without a resolve', async () => {
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { resolutionNotes: 'premature' },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects deadlineExtensionDays sent without a resolve', async () => {
      // The extension is an explicit decision made at resolve time, never
      // derived from how long the blocker was open.
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { deadlineExtensionDays: 3 },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts deadlineExtensionDays alongside a resolve', async () => {
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          {
            status: BlockerStatus.RESOLVED,
            resolutionNotes: 'done',
            deadlineExtensionDays: 3,
          },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).resolves.toBeDefined();
    });

    it('extends the deadline ADDITIVELY from the current one', async () => {
      // Additive, never an absolute override, matching how an approved
      // AdditionalRequirement extends a deadline.
      await service.updateBlocker(
        BLOCKER_ID,
        {
          status: BlockerStatus.RESOLVED,
          resolutionNotes: 'done',
          deadlineExtensionDays: 3,
        },
        REPORTER_ID,
        Role.DEVELOPER,
      );
      const call = prisma.project.update.mock.calls.find(
        ([arg]: any) => arg?.data?.deadline instanceof Date,
      );
      expect(call).toBeDefined();
      // 2026-09-01 plus three days.
      expect((call[0].data.deadline as Date).toISOString().slice(0, 10)).toBe(
        '2026-09-04',
      );
    });
  });

  describe('who may edit', () => {
    it('allows the original reporter', async () => {
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { description: 'clarified' },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).resolves.toBeDefined();
    });

    it('rejects a different developer who is not the PM', async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { description: 'meddling' },
          OTHER_DEV_ID,
          Role.DEVELOPER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a PROJECT_MANAGER staffed on the project', async () => {
      await expect(
        service.updateBlocker(
          BLOCKER_ID,
          { description: 'triaged' },
          PM_ID,
          Role.PROJECT_MANAGER,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('not found', () => {
    it('throws 404 for a blocker that does not exist', async () => {
      prisma.blocker.findUnique.mockResolvedValue(null);
      await expect(
        service.updateBlocker(
          'ghost',
          { description: 'x' },
          REPORTER_ID,
          Role.DEVELOPER,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
