import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DailyWorkReportStatus, NotificationType, Role } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { NotificationsService } from '@/notifications/notifications.service';

import { DailyProjectEntryService } from '@/work-reports/entries/daily-project-entry.service';

const AUTHOR = 'dev-1';
const REVIEWER = 'pm-1';

describe('DailyProjectEntryService', () => {
  let service: DailyProjectEntryService;

  const prisma = {
    dailyProjectEntry: { findUnique: jest.fn(), update: jest.fn() },
    projectMember: { findFirst: jest.fn() },
  };
  const projectActivity = { log: jest.fn() };
  const notificationsService = { notify: jest.fn() };

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
      ],
    }).compile();
    service = moduleRef.get(DailyProjectEntryService);
    prisma.dailyProjectEntry.update.mockImplementation(() =>
      Promise.resolve(entry()),
    );
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
    it.each([Role.ADMIN, Role.SYSTEM_ADMIN])(
      '%s may review without being staffed',
      async (role) => {
        prisma.dailyProjectEntry.findUnique.mockResolvedValue(entry());
        await service.review('e1', {}, 'admin-1', role);
        expect(prisma.projectMember.findFirst).not.toHaveBeenCalled();
      },
    );

    it('a PROJECT_MANAGER must manage THIS project', async () => {
      prisma.dailyProjectEntry.findUnique.mockResolvedValue(entry());
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.review('e1', {}, REVIEWER, Role.PROJECT_MANAGER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('passes for a PM staffed as this project as its manager', async () => {
      prisma.dailyProjectEntry.findUnique.mockResolvedValue(entry());
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'm1' });
      await expect(
        service.review('e1', {}, REVIEWER, Role.PROJECT_MANAGER),
      ).resolves.toBeDefined();
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
