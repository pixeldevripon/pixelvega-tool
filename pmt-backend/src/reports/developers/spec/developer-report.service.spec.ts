/**
 * First unit tests for DeveloperReportService.
 *
 * PrismaService and both time-entry collaborators are mocked. No database
 * connection. Focused on the two things this service just changed: that the
 * TARGET user's own weeklyOffDay (never the actor's, never a default) is
 * what the working-day count is built from, and the self-vs-other permission
 * branch that decides whose report a caller may request.
 *
 * The many parallel helper computations (blockers, leave, projects touched,
 * daily work report compliance) are stubbed to empty/zero results throughout:
 * they are not the subject of this change and are exercised elsewhere.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, Weekday } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectTimeEntriesService } from '@/projects/time-entries/project/project-time-entries.service';
import { MeetingTimeEntriesService } from '@/projects/time-entries/meetings/meeting-time-entries.service';
import { DeveloperReportService } from '../developer-report.service';

const ACTOR_ID = 'actor-1';
const OTHER_USER_ID = 'other-1';

function createMockPrisma() {
  return {
    user: { findFirst: jest.fn() },
    project: { findUnique: jest.fn() },
    holiday: { findMany: jest.fn().mockResolvedValue([]) },
    timeEntry: { findMany: jest.fn().mockResolvedValue([]) },
    dailyWorkReport: { findMany: jest.fn().mockResolvedValue([]) },
    dailyProjectEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    blocker: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    leaveRequest: { findMany: jest.fn().mockResolvedValue([]) },
    projectMember: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function setUser(
  prisma: ReturnType<typeof createMockPrisma>,
  overrides: Record<string, unknown> = {},
) {
  const user = {
    id: OTHER_USER_ID,
    role: Role.DEVELOPER,
    weeklyOffDay: Weekday.FRIDAY,
    ...overrides,
  };
  prisma.user.findFirst.mockResolvedValue(user);
  return user;
}

describe('DeveloperReportService', () => {
  let service: DeveloperReportService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let meetingTimeEntriesService: { findDailySummaryForUser: jest.Mock };
  let projectTimeEntriesService: { findProjectSummaryForUser: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    meetingTimeEntriesService = {
      findDailySummaryForUser: jest.fn().mockResolvedValue({
        totalProjectMinutes: 0,
        totalMeetingMinutes: 0,
        days: [],
      }),
    };
    projectTimeEntriesService = {
      findProjectSummaryForUser: jest.fn().mockResolvedValue({
        projects: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeveloperReportService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ProjectTimeEntriesService,
          useValue: projectTimeEntriesService,
        },
        {
          provide: MeetingTimeEntriesService,
          useValue: meetingTimeEntriesService,
        },
      ],
    }).compile();

    service = module.get(DeveloperReportService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('workingDaysInRange: whose weeklyOffDay counts', () => {
    // Monday 2026-08-17 through Friday 2026-08-21: a Friday-off person loses
    // one of these five days, a Saturday-off person loses none. Any bug that
    // reads the actor's day, or the WEEKLY_OFF_DAY default, or ignores the
    // user row entirely, produces 4 here instead of 5.
    const query = {
      startDate: '2026-08-17',
      endDate: '2026-08-21',
    };

    it("counts against the TARGET user's own weeklyOffDay, not a default", async () => {
      setUser(prisma, {
        id: OTHER_USER_ID,
        weeklyOffDay: Weekday.SATURDAY,
      });

      const result = await service.getDeveloperReport(ACTOR_ID, Role.ADMIN, {
        ...query,
        userId: OTHER_USER_ID,
      });

      expect(result.workingDaysInRange).toBe(5);
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: OTHER_USER_ID, deletedAt: null },
        }),
      );
    });

    it('produces a different count for the same range when the target is Friday-off', async () => {
      setUser(prisma, {
        id: OTHER_USER_ID,
        weeklyOffDay: Weekday.FRIDAY,
      });

      const result = await service.getDeveloperReport(ACTOR_ID, Role.ADMIN, {
        ...query,
        userId: OTHER_USER_ID,
      });

      expect(result.workingDaysInRange).toBe(4);
    });

    it("uses the target user's weeklyOffDay even when the actor is fetching their own report", async () => {
      // actorId === userId here, so this also confirms the field read is
      // `user.weeklyOffDay` (the row just fetched), not some other source.
      setUser(prisma, { id: ACTOR_ID, weeklyOffDay: Weekday.SATURDAY });

      const result = await service.getDeveloperReport(
        ACTOR_ID,
        Role.DEVELOPER,
        query,
      );

      expect(result.workingDaysInRange).toBe(5);
    });
  });

  describe('self vs other-user access', () => {
    const query = { startDate: '2026-08-17', endDate: '2026-08-21' };

    it('rejects a non-staff actor requesting a report for someone else', async () => {
      setUser(prisma, { id: OTHER_USER_ID });

      await expect(
        service.getDeveloperReport(ACTOR_ID, Role.DEVELOPER, {
          ...query,
          userId: OTHER_USER_ID,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.getDeveloperReport(ACTOR_ID, Role.DESIGNER, {
          ...query,
          userId: OTHER_USER_ID,
        }),
      ).rejects.toThrow('You can only view your own developer report');
    });

    it('allows a non-staff actor to request their own report explicitly', async () => {
      setUser(prisma, { id: ACTOR_ID });

      await expect(
        service.getDeveloperReport(ACTOR_ID, Role.DEVELOPER, {
          ...query,
          userId: ACTOR_ID,
        }),
      ).resolves.toBeDefined();
    });

    it("allows a staff actor (PROJECT_MANAGER) to request someone else's report", async () => {
      setUser(prisma, { id: OTHER_USER_ID });

      const result = await service.getDeveloperReport(
        ACTOR_ID,
        Role.PROJECT_MANAGER,
        { ...query, userId: OTHER_USER_ID },
      );

      expect(result.userId).toBe(OTHER_USER_ID);
    });

    it("allows a staff actor (ADMIN) to request someone else's report", async () => {
      setUser(prisma, { id: OTHER_USER_ID });

      const result = await service.getDeveloperReport(ACTOR_ID, Role.ADMIN, {
        ...query,
        userId: OTHER_USER_ID,
      });

      expect(result.userId).toBe(OTHER_USER_ID);
    });

    it('defaults to the actor themselves when no userId is given', async () => {
      setUser(prisma, { id: ACTOR_ID });

      const result = await service.getDeveloperReport(
        ACTOR_ID,
        Role.DEVELOPER,
        query,
      );

      expect(result.userId).toBe(ACTOR_ID);
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ACTOR_ID, deletedAt: null } }),
      );
    });
  });

  describe('target user not found', () => {
    it('throws NotFoundException when the target user row does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.getDeveloperReport(ACTOR_ID, Role.ADMIN, {
          startDate: '2026-08-17',
          endDate: '2026-08-21',
          userId: OTHER_USER_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
