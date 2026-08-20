import { Test } from '@nestjs/testing';
import {
  DailyWorkReportStatus,
  NotificationType,
  Weekday,
} from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { SlackService } from '@/slack/slack.service';
import { NotificationsService } from '../notifications.service';
import { NotificationsSchedulerService } from '../notifications-scheduler.service';

// A Friday and a Saturday, both pinned at UTC noon so the +6 Asia/Dhaka
// offset never rolls the calendar date over: the assertions below can talk
// about "Friday" and "Saturday" without also reasoning about a UTC/Dhaka
// day boundary crossing.
const A_FRIDAY = new Date('2026-08-21T12:00:00.000Z');
const A_SATURDAY = new Date('2026-08-22T12:00:00.000Z');
const A_MONDAY = new Date('2026-08-17T12:00:00.000Z');

describe('NotificationsSchedulerService', () => {
  let service: NotificationsSchedulerService;
  let prisma: any;
  let notificationsService: { notify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
      dailyWorkReport: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { count: jest.fn().mockResolvedValue(0) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
    };
    notificationsService = { notify: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsSchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: SlackService, useValue: { postMessage: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(NotificationsSchedulerService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('checkMissedStandups', () => {
    it("excludes only Friday-off people's eligibility on a Friday", async () => {
      jest.useFakeTimers().setSystemTime(A_FRIDAY);
      await service.checkMissedStandups();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            weeklyOffDay: { not: Weekday.FRIDAY },
          }),
        }),
      );
    });

    it("excludes only Saturday-off people's eligibility on a Saturday", async () => {
      jest.useFakeTimers().setSystemTime(A_SATURDAY);
      await service.checkMissedStandups();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            weeklyOffDay: { not: Weekday.SATURDAY },
          }),
        }),
      );
    });

    it('applies no weeklyOffDay filter at all on an ordinary weekday', async () => {
      // Nobody's off day is a Monday, so the eligible set is exactly the role
      // filter: adding a `weeklyOffDay: { not: undefined }` clause here would
      // silently exclude anyone whose weeklyOffDay value is falsy in a mock.
      jest.useFakeTimers().setSystemTime(A_MONDAY);
      await service.checkMissedStandups();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: { in: expect.any(Array) },
            deletedAt: null,
          },
        }),
      );
    });

    it('notifies only people who have not submitted today', async () => {
      jest.useFakeTimers().setSystemTime(A_MONDAY);
      prisma.user.findMany.mockResolvedValue([
        { id: 'submitted-1' },
        { id: 'missing-1' },
      ]);
      prisma.dailyWorkReport.findMany.mockResolvedValue([
        { userId: 'submitted-1' },
      ]);

      await service.checkMissedStandups();

      expect(notificationsService.notify).toHaveBeenCalledTimes(1);
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'missing-1',
          type: NotificationType.STANDUP_MISSED,
        }),
      );
    });

    it('does not notify someone already notified today, on a restart', async () => {
      jest.useFakeTimers().setSystemTime(A_MONDAY);
      prisma.user.findMany.mockResolvedValue([{ id: 'missing-1' }]);
      prisma.notification.count.mockResolvedValue(1);

      await service.checkMissedStandups();

      expect(notificationsService.notify).not.toHaveBeenCalled();
    });
  });

  describe('checkMissedWrapUps', () => {
    it('filters the query by the Dhaka weekend day, via the user relation', async () => {
      jest.useFakeTimers().setSystemTime(A_SATURDAY);
      await service.checkMissedWrapUps();

      expect(prisma.dailyWorkReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: DailyWorkReportStatus.PLAN_SUBMITTED,
            user: { weeklyOffDay: { not: Weekday.SATURDAY } },
          }),
        }),
      );
    });

    it('carries no user relation filter on an ordinary weekday', async () => {
      jest.useFakeTimers().setSystemTime(A_MONDAY);
      await service.checkMissedWrapUps();

      expect(prisma.dailyWorkReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: expect.any(Date),
            status: DailyWorkReportStatus.PLAN_SUBMITTED,
          },
        }),
      );
    });

    it('notifies every user with an incomplete report the query returned', async () => {
      jest.useFakeTimers().setSystemTime(A_MONDAY);
      prisma.dailyWorkReport.findMany.mockResolvedValue([
        { userId: 'incomplete-1' },
      ]);

      await service.checkMissedWrapUps();

      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'incomplete-1',
          type: NotificationType.WRAP_UP_MISSED,
        }),
      );
    });
  });

  describe('checkDeadlinesApproaching', () => {
    it('is unaffected by weeklyOffDay: the query carries no such filter, even on a weekend', async () => {
      // A deadline reminder is deliberately not filtered by who is off. The
      // exact `where` shape below has no room for a weeklyOffDay clause to
      // hide in, unlike an objectContaining check would.
      jest.useFakeTimers().setSystemTime(A_FRIDAY);
      await service.checkDeadlinesApproaching();

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: expect.any(Array) },
          deadline: { gte: expect.any(Date), lt: expect.any(Date) },
        },
        select: expect.any(Object),
      });
    });
  });
});
