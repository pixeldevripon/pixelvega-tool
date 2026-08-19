/**
 * Unit tests for reviewing an additional requirement.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * The rule that matters: approving is ADDITIVE. Hours add onto the current
 * estimate and days add onto the current deadline, never replacing either. An
 * absolute override would silently discard work already scoped.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdditionalRequirementStatus, Role } from '@prisma/client';
import { AiJobsService } from '@/ai/ai-jobs.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { ProjectScopeService } from '@/project-scope/project-scope.service';
import { AdditionalRequirementsService } from '../additional-requirements.service';

const PROJECT_ID = 'project-1';
const REQ_ID = 'req-1';
const PM_ID = 'pm-1';

describe('AdditionalRequirementsService: review', () => {
  let service: AdditionalRequirementsService;
  let prisma: any;

  function setProject(estimatedHours: number | null, deadline: Date | null) {
    const project = {
      id: PROJECT_ID,
      estimatedHours,
      deadline,
      slackChannelId: null,
    };
    prisma.project.findUnique.mockResolvedValue(project);
    prisma.project.findUniqueOrThrow.mockResolvedValue(project);
  }

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      projectMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      additionalRequirement: {
        findFirst: jest.fn().mockResolvedValue({
          id: REQ_ID,
          projectId: PROJECT_ID,
          status: AdditionalRequirementStatus.PENDING_REVIEW,
          description: 'Add a blog',
        }),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: REQ_ID,
            projectId: PROJECT_ID,
            ...data,
            requestedBy: { id: 'c1', name: 'Client' },
          }),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectScopeService,
        AdditionalRequirementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectActivityService, useValue: { log: jest.fn() } },
        { provide: AiJobsService, useValue: { enqueue: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: {
            notify: jest.fn(),
            resolveManagingPmAndAdminIds: jest.fn().mockResolvedValue([]),
            resolveAllActiveMembersAndAdminIds: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(AdditionalRequirementsService);
    setProject(100, new Date('2026-09-01'));
  });

  afterEach(() => jest.clearAllMocks());

  describe('review happens exactly once', () => {
    it.each([
      AdditionalRequirementStatus.APPROVED,
      AdditionalRequirementStatus.REJECTED,
    ])('rejects reviewing something already %s', async (status) => {
      prisma.additionalRequirement.findFirst.mockResolvedValue({
        id: REQ_ID,
        projectId: PROJECT_ID,
        status,
        description: 'x',
      });
      await expect(
        service.review(
          PROJECT_ID,
          REQ_ID,
          { decision: AdditionalRequirementStatus.APPROVED },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws 404 for a requirement that does not exist', async () => {
      prisma.additionalRequirement.findFirst.mockResolvedValue(null);
      await expect(
        service.review(
          PROJECT_ID,
          'ghost',
          { decision: AdditionalRequirementStatus.APPROVED },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('the approve only fields', () => {
    it('rejects approvedAdditionalHours sent with a REJECTED decision', async () => {
      await expect(
        service.review(
          PROJECT_ID,
          REQ_ID,
          {
            decision: AdditionalRequirementStatus.REJECTED,
            approvedAdditionalHours: 10,
          },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects deadlineExtensionDays sent with a REJECTED decision', async () => {
      await expect(
        service.review(
          PROJECT_ID,
          REQ_ID,
          {
            decision: AdditionalRequirementStatus.REJECTED,
            deadlineExtensionDays: 5,
          },
          PM_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('approving is additive, never an override', () => {
    it('ADDS the approved hours onto the current estimate', async () => {
      setProject(100, new Date('2026-09-01'));
      await service.review(
        PROJECT_ID,
        REQ_ID,
        {
          decision: AdditionalRequirementStatus.APPROVED,
          approvedAdditionalHours: 20,
        },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estimatedHours: 120 }),
        }),
      );
    });

    it('treats a null estimate as zero rather than skipping the update', async () => {
      setProject(null, new Date('2026-09-01'));
      await service.review(
        PROJECT_ID,
        REQ_ID,
        {
          decision: AdditionalRequirementStatus.APPROVED,
          approvedAdditionalHours: 15,
        },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estimatedHours: 15 }),
        }),
      );
    });

    it('ADDS the extension days onto the current deadline', async () => {
      setProject(100, new Date('2026-09-01T00:00:00Z'));
      await service.review(
        PROJECT_ID,
        REQ_ID,
        {
          decision: AdditionalRequirementStatus.APPROVED,
          deadlineExtensionDays: 7,
        },
        PM_ID,
        Role.ADMIN,
      );
      const call = prisma.project.update.mock.calls.find(
        ([a]: any) => a?.data?.deadline,
      );
      expect((call[0].data.deadline as Date).toISOString().slice(0, 10)).toBe(
        '2026-09-08',
      );
    });

    it('extends from today when the project has no deadline yet', async () => {
      setProject(100, null);
      await service.review(
        PROJECT_ID,
        REQ_ID,
        {
          decision: AdditionalRequirementStatus.APPROVED,
          deadlineExtensionDays: 3,
        },
        PM_ID,
        Role.ADMIN,
      );
      const call = prisma.project.update.mock.calls.find(
        ([a]: any) => a?.data?.deadline,
      );
      const expected = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      expect(
        Math.abs(
          (call[0].data.deadline as Date).getTime() - expected.getTime(),
        ),
      ).toBeLessThan(60_000);
    });

    it('touches the project at all only when a field was actually supplied', async () => {
      await service.review(
        PROJECT_ID,
        REQ_ID,
        { decision: AdditionalRequirementStatus.APPROVED },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('leaves the project untouched on a REJECTED decision', async () => {
      await service.review(
        PROJECT_ID,
        REQ_ID,
        { decision: AdditionalRequirementStatus.REJECTED },
        PM_ID,
        Role.ADMIN,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });
  });
});
