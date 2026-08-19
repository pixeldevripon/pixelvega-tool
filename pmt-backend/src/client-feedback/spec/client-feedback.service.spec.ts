/**
 * Unit tests for client feedback.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * The rule that carries the weight: ONLY the first round moves the project.
 * Every later round is commentary, so a developer already back in progress on
 * the first round's decision is never interrupted by later client input.
 */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientFeedbackDecision, ProjectStatus, Role } from '@prisma/client';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { ClientFeedbackService } from '../client-feedback.service';

const PROJECT_ID = 'project-1';
const CLIENT_ID = 'client-1';
const PM_ID = 'pm-1';

describe('ClientFeedbackService', () => {
  let service: ClientFeedbackService;
  let prisma: any;

  function setProject(status: ProjectStatus) {
    prisma.project.findUnique.mockResolvedValue({
      id: PROJECT_ID,
      status,
      clientId: CLIENT_ID,
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
      clientFeedback: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'fb-1',
            ...data,
            client: { id: CLIENT_ID, name: 'Client' },
          }),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientFeedbackService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectActivityService, useValue: { log: jest.fn() } },
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

    service = module.get(ClientFeedbackService);
    setProject(ProjectStatus.WAITING_FOR_FEEDBACK);
  });

  afterEach(() => jest.clearAllMocks());

  describe('the FIRST round', () => {
    beforeEach(() => prisma.clientFeedback.count.mockResolvedValue(0));

    it('requires the project to be WAITING_FOR_FEEDBACK', async () => {
      setProject(ProjectStatus.IN_PROGRESS);
      await expect(
        service.create(
          PROJECT_ID,
          { decision: ClientFeedbackDecision.APPROVED },
          CLIENT_ID,
          Role.CLIENT,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('APPROVED completes the project and stamps completedAt', async () => {
      await service.create(
        PROJECT_ID,
        { decision: ClientFeedbackDecision.APPROVED },
        CLIENT_ID,
        Role.CLIENT,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ProjectStatus.COMPLETED,
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('CHANGES_REQUESTED sends the project back to READY_FOR_WORK', async () => {
      await service.create(
        PROJECT_ID,
        {
          decision: ClientFeedbackDecision.CHANGES_REQUESTED,
          comments: 'Logo is wrong',
        },
        CLIENT_ID,
        Role.CLIENT,
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ProjectStatus.READY_FOR_WORK,
          }),
        }),
      );
    });

    it('is numbered round 1', async () => {
      await service.create(
        PROJECT_ID,
        { decision: ClientFeedbackDecision.APPROVED },
        CLIENT_ID,
        Role.CLIENT,
      );
      expect(prisma.clientFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ feedbackRound: 1 }),
        }),
      );
    });
  });

  describe('every LATER round is commentary only', () => {
    beforeEach(() => prisma.clientFeedback.count.mockResolvedValue(2));

    it('does NOT move the project, even on APPROVED', async () => {
      // The whole point: a developer already back in progress must not be
      // interrupted by a client comment arriving later.
      setProject(ProjectStatus.IN_PROGRESS);
      await service.create(
        PROJECT_ID,
        { decision: ClientFeedbackDecision.APPROVED },
        CLIENT_ID,
        Role.CLIENT,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('is accepted regardless of the project status', async () => {
      setProject(ProjectStatus.READY_FOR_WORK);
      await expect(
        service.create(
          PROJECT_ID,
          { decision: ClientFeedbackDecision.APPROVED },
          CLIENT_ID,
          Role.CLIENT,
        ),
      ).resolves.toBeDefined();
    });

    it('is numbered from the existing count', async () => {
      setProject(ProjectStatus.IN_PROGRESS);
      await service.create(
        PROJECT_ID,
        { decision: ClientFeedbackDecision.APPROVED },
        CLIENT_ID,
        Role.CLIENT,
      );
      expect(prisma.clientFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ feedbackRound: 3 }),
        }),
      );
    });

    it.each([ProjectStatus.COMPLETED, ProjectStatus.CANCELLED])(
      'is rejected once the project is %s',
      async (status) => {
        setProject(status);
        await expect(
          service.create(
            PROJECT_ID,
            { decision: ClientFeedbackDecision.APPROVED },
            CLIENT_ID,
            Role.CLIENT,
          ),
        ).rejects.toThrow(/already closed/i);
      },
    );
  });

  describe('comments are required exactly when requesting changes', () => {
    it('rejects CHANGES_REQUESTED with no comments', async () => {
      await expect(
        service.create(
          PROJECT_ID,
          { decision: ClientFeedbackDecision.CHANGES_REQUESTED },
          CLIENT_ID,
          Role.CLIENT,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('who submitted it stays distinguishable', () => {
    it('records recordedById as null for a direct CLIENT submission', async () => {
      await service.create(
        PROJECT_ID,
        { decision: ClientFeedbackDecision.APPROVED },
        CLIENT_ID,
        Role.CLIENT,
      );
      expect(prisma.clientFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recordedById: null }),
        }),
      );
    });

    it('records the PM as recordedById when a PM logs it on the client behalf', async () => {
      await service.create(
        PROJECT_ID,
        { decision: ClientFeedbackDecision.APPROVED },
        PM_ID,
        Role.PROJECT_MANAGER,
      );
      expect(prisma.clientFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recordedById: PM_ID }),
        }),
      );
    });
  });
});
