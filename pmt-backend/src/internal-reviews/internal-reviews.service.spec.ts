/**
 * Unit tests for the internal review gate.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * This service is the ONLY path a project may take out of INTERNAL_REVIEW to
 * READY_FOR_CLIENT or back to READY_FOR_WORK. The generic status endpoint
 * deliberately cannot make either move (see ALLOWED_STATUS_TRANSITIONS), so a
 * ProjectInternalReview row always exists to explain the transition.
 */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalReviewDecision, ProjectStatus, Role } from '@prisma/client';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/projects/project-activity.service';
import { InternalReviewsService } from './internal-reviews.service';

const PROJECT_ID = 'project-1';
const PM_ID = 'pm-1';

describe('InternalReviewsService', () => {
  let service: InternalReviewsService;
  let prisma: any;
  let projectActivity: { log: jest.Mock };

  function setProject(status: ProjectStatus) {
    prisma.project.findUnique.mockResolvedValue({
      id: PROJECT_ID,
      status,
      clientId: 'client-1',
      slackChannelId: null,
    });
  }

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      projectMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      projectInternalReview: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'review-1',
            ...data,
            reviewedBy: { id: PM_ID, name: 'PM' },
          }),
        ),
      },
    };
    projectActivity = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectActivityService, useValue: projectActivity },
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

    service = module.get(InternalReviewsService);
    setProject(ProjectStatus.INTERNAL_REVIEW);
  });

  afterEach(() => jest.clearAllMocks());

  describe('the project must be in INTERNAL_REVIEW', () => {
    it.each([
      ProjectStatus.IN_PROGRESS,
      ProjectStatus.READY_FOR_WORK,
      ProjectStatus.COMPLETED,
      ProjectStatus.PLANNING,
    ])('rejects a review while the project is %s', async (status) => {
      setProject(status);
      await expect(
        service.create(
          PROJECT_ID,
          { decision: InternalReviewDecision.APPROVED },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('decisions move the project', () => {
    it('APPROVED moves the project to READY_FOR_CLIENT', async () => {
      await service.create(
        PROJECT_ID,
        { decision: InternalReviewDecision.APPROVED },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ProjectStatus.READY_FOR_CLIENT },
        }),
      );
    });

    it('CHANGES_REQUIRED moves the project back to READY_FOR_WORK', async () => {
      await service.create(
        PROJECT_ID,
        {
          decision: InternalReviewDecision.CHANGES_REQUIRED,
          comments: 'Fix the nav',
        },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ProjectStatus.READY_FOR_WORK },
        }),
      );
    });
  });

  describe('comments are required exactly when requesting changes', () => {
    it('rejects CHANGES_REQUIRED with no comments', async () => {
      // Without them the developer has nothing actionable to fix.
      await expect(
        service.create(
          PROJECT_ID,
          { decision: InternalReviewDecision.CHANGES_REQUIRED },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts APPROVED with no comments', async () => {
      await expect(
        service.create(
          PROJECT_ID,
          { decision: InternalReviewDecision.APPROVED },
          PM_ID,
          Role.ADMIN,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('review rounds are an append only history', () => {
    it('starts at round 1 for the first review', async () => {
      prisma.projectInternalReview.count.mockResolvedValue(0);
      await service.create(
        PROJECT_ID,
        { decision: InternalReviewDecision.APPROVED },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.projectInternalReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reviewRound: 1 }),
        }),
      );
    });

    it('increments the round and never skips a number', async () => {
      prisma.projectInternalReview.count.mockResolvedValue(3);
      await service.create(
        PROJECT_ID,
        { decision: InternalReviewDecision.APPROVED },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.projectInternalReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reviewRound: 4 }),
        }),
      );
    });

    it('inserts a new row rather than updating the previous review', async () => {
      await service.create(
        PROJECT_ID,
        { decision: InternalReviewDecision.APPROVED },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.projectInternalReview.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('activity logging', () => {
    it('logs both the review and the status change', async () => {
      await service.create(
        PROJECT_ID,
        { decision: InternalReviewDecision.APPROVED },
        PM_ID,
        Role.ADMIN,
      );
      const types = projectActivity.log.mock.calls.map((c) => c[2]);
      expect(types).toContain('INTERNAL_FEEDBACK_RECEIVED');
      expect(types).toContain('STATUS_CHANGED');
    });
  });
});
