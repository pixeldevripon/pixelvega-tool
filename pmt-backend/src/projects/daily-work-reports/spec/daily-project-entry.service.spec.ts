import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DailyWorkReportStatus, NotificationType, Role } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/projects/activity/project-activity.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { ProjectScopeService } from '@/projects/scope/project-scope.service';

import { DailyProjectEntryService } from '@/projects/daily-work-reports/daily-project-entry.service';

const AUTHOR = 'dev-1';
const REVIEWER = 'pm-1';

describe('DailyProjectEntryService', () => {
  let service: DailyProjectEntryService;

  const prisma = {
    dailyProjectEntry: { findUnique: jest.fn(), update: jest.fn() },
  };
  const projectActivity = { log: jest.fn() };
  const notificationsService = { notify: jest.fn() };
  const projectScope = {
    assertManagesProject: jest.fn(),
    managesProject: jest.fn(),
  };

  function entry(
    status: DailyWorkReportStatus = DailyWorkReportStatus.COMPLETED,
  ) {
    return {
      id: 'e1',
      projectId: 'p1',
      dailyWorkReportId: 'r1',
      plan: 'Ship auth',
      accomplishments: 'Shipped auth',
      reviewedAt: null,
      reviewComment: null,
      project: { id: 'p1', name: 'Acme corporate site' },
      reviewedBy: null,
      dailyWorkReport: { id: 'r1', userId: AUTHOR, status },
    };
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DailyProjectEntryService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectActivityService, useValue: projectActivity },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ProjectScopeService, useValue: projectScope },
      ],
    }).compile();
    service = moduleRef.get(DailyProjectEntryService);
    prisma.dailyProjectEntry.update.mockImplementation(() =>
      Promise.resolve(entry()),
    );
    projectScope.assertManagesProject.mockResolvedValue(undefined);
  });

  it('404s on an entry that does not exist', async () => {
    prisma.dailyProjectEntry.findUnique.mockResolvedValue(null);
    await expect(
      service.review('nope', {}, REVIEWER, Role.ADMIN),
    ).rejects.toThrow(NotFoundException);
  });

  describe('the wrap-up must be in first', () => {
    it.each([
      DailyWorkReportStatus.DRAFT,
      DailyWorkReportStatus.PLAN_SUBMITTED,
    ])('refuses to review while the report is %s', async (status) => {
      // Reviewing a plan before the day is done is reviewing an intention,
      // not work.
      prisma.dailyProjectEntry.findUnique.mockResolvedValue(entry(status));
      await expect(
        service.review('e1', {}, REVIEWER, Role.ADMIN),
      ).rejects.toThrow(ConflictException);
      expect(prisma.dailyProjectEntry.update).not.toHaveBeenCalled();
    });

    it('allows it once COMPLETED', async () => {
      prisma.dailyProjectEntry.findUnique.mockResolvedValue(entry());
      await expect(
        service.review('e1', {}, REVIEWER, Role.ADMIN),
      ).resolves.toBeDefined();
    });
  });

  describe('who may review', () => {
    // Reviewing is a manager's act, and the rule belongs to
    // ProjectScopeService, not to a private copy here. What this level can
    // assert is that the question is asked about the right project and the
    // right caller, and that a refusal is not swallowed. Who satisfies
    // `managesProject` is that service's own spec.
    it("asks the scope service about THIS entry's project and the caller", async () => {
      prisma.dailyProjectEntry.findUnique.mockResolvedValue(entry());
      await service.review('e1', {}, REVIEWER, Role.PROJECT_MANAGER);
      expect(projectScope.assertManagesProject).toHaveBeenCalledWith(
        'p1',
        REVIEWER,
        Role.PROJECT_MANAGER,
      );
    });

    it('does not review when the scope service refuses', async () => {
      prisma.dailyProjectEntry.findUnique.mockResolvedValue(entry());
      projectScope.assertManagesProject.mockRejectedValue(
        new ForbiddenException('You do not manage this project'),
      );
      await expect(
        service.review('e1', {}, REVIEWER, Role.PROJECT_MANAGER),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.dailyProjectEntry.update).not.toHaveBeenCalled();
    });

    it('reports the review it just performed as permitted', async () => {
      // The caller manages the project, or the assertion above would have
      // thrown, so the flag on the response has to say so. Returning
      // `canReview: false` on the very entry the caller just reviewed is what
      // the previous version did once the flag started consulting the project.
      prisma.dailyProjectEntry.findUnique.mockResolvedValue(entry());
      const result = await service.review(
        'e1',
        {},
        REVIEWER,
        Role.PROJECT_MANAGER,
      );
      expect(result.capabilities.canReview).toBe(true);
    });
  });

  describe('the review itself', () => {
    beforeEach(() => {
      prisma.dailyProjectEntry.findUnique.mockResolvedValue(entry());
    });

    it('records who reviewed it and when', async () => {
      await service.review(
        'e1',
        { reviewComment: 'Nice work' },
        REVIEWER,
        Role.ADMIN,
      );
      const data = (
        prisma.dailyProjectEntry.update.mock.calls[0][0] as {
          data: {
            reviewedById: string;
            reviewedAt: Date;
            reviewComment?: string;
          };
        }
      ).data;
      expect(data.reviewedById).toBe(REVIEWER);
      expect(data.reviewedAt).toBeInstanceOf(Date);
      expect(data.reviewComment).toBe('Nice work');
    });

    it('logs the review on the project timeline', async () => {
      await service.review('e1', {}, REVIEWER, Role.ADMIN);
      expect(projectActivity.log).toHaveBeenCalledWith(
        'p1',
        REVIEWER,
        'WORK_REPORT_REVIEWED',
        expect.objectContaining({ metadata: { dailyProjectEntryId: 'e1' } }),
      );
    });

    it('notifies the author when a comment was left', async () => {
      await service.review(
        'e1',
        { reviewComment: 'Nice work' },
        REVIEWER,
        Role.ADMIN,
      );
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: AUTHOR,
          type: NotificationType.WORK_REPORT_COMMENTED,
          message: 'Nice work',
        }),
      );
    });

    it('sends nothing for a review with no comment', async () => {
      // "Reviewed, no comment" gives the author nothing to act on, so it is
      // not worth a notification.
      await service.review('e1', {}, REVIEWER, Role.ADMIN);
      expect(notificationsService.notify).not.toHaveBeenCalled();
    });

    it('does not notify someone about their own comment', async () => {
      await service.review(
        'e1',
        { reviewComment: 'Note to self' },
        AUTHOR,
        Role.ADMIN,
      );
      expect(notificationsService.notify).not.toHaveBeenCalled();
    });
  });
});
