/**
 * First unit tests for ProjectReportService.
 *
 * PrismaService and ProjectScopeService are mocked. No database connection.
 * Focused on the team-becomes-a-spread change: `workingDays` is no longer one
 * number for the whole roster, it is one count per active member (each
 * against THEIR OWN weeklyOffDay) plus the team's average/min/max, and
 * `planningCoverageRate` now divides by that average.
 *
 * computeWorkingDaysByMember itself already has a thorough spec at
 * src/common/working-day/spec/working-day.util.spec.ts; these tests check
 * that ProjectReportService wires activeMembers, the range, and holidays
 * into it correctly and reads the result back into the response, not the
 * arithmetic inside that pure function again.
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DailyWorkReportStatus,
  ProjectPriority,
  ProjectStatus,
  Role,
  Weekday,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectScopeService } from '@/projects/scope/project-scope.service';
import { ProjectReportService } from '../project-report.service';

const PROJECT_ID = 'project-1';
const ACTOR_ID = 'actor-1';

function createMockPrisma() {
  return {
    project: { findUnique: jest.fn() },
    projectMember: { findMany: jest.fn().mockResolvedValue([]) },
    timeEntry: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    projectActivity: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    blocker: { findMany: jest.fn().mockResolvedValue([]) },
    additionalRequirement: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    projectInternalReview: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    clientFeedback: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    dailyProjectEntry: { findMany: jest.fn().mockResolvedValue([]) },
    holiday: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function setProject(
  prisma: ReturnType<typeof createMockPrisma>,
  overrides: Record<string, unknown> = {},
) {
  const project = {
    id: PROJECT_ID,
    status: ProjectStatus.IN_PROGRESS,
    priority: ProjectPriority.MEDIUM,
    estimatedHours: null,
    actualHours: 0,
    plannedStartDate: null,
    deadline: null,
    ...overrides,
  };
  prisma.project.findUnique.mockResolvedValue(project);
  return project;
}

function member(userId: string, name: string, weeklyOffDay: Weekday) {
  return {
    userId,
    role: 'DEVELOPER',
    user: { id: userId, name, weeklyOffDay },
  };
}

// Monday 2026-08-17 through Friday 2026-08-21: a Friday-off member loses one
// of these five days, a Saturday-off member loses none, so the two counts
// (4 vs 5) genuinely differ over the same range.
const RANGE = { startDate: '2026-08-17', endDate: '2026-08-21' };

describe('ProjectReportService', () => {
  let service: ProjectReportService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let projectScope: { assertActiveMember: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    projectScope = {
      assertActiveMember: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectScopeService, useValue: projectScope },
      ],
    }).compile();

    service = module.get(ProjectReportService);
    setProject(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  describe('workingDays: one count per active member, against their own weeklyOffDay', () => {
    it('gives a Friday-off and a Saturday-off member different counts over the same range', async () => {
      prisma.projectMember.findMany.mockResolvedValue([
        member('u1', 'Ada', Weekday.FRIDAY),
        member('u2', 'Bea', Weekday.SATURDAY),
      ]);

      const result = await service.getProjectReport(
        PROJECT_ID,
        ACTOR_ID,
        Role.ADMIN,
        RANGE,
      );

      expect(result.workingDays.byMember).toEqual([
        { userId: 'u1', name: 'Ada', workingDays: 4 },
        { userId: 'u2', name: 'Bea', workingDays: 5 },
      ]);
    });

    it('computes average/min/max across a mixed roster', async () => {
      prisma.projectMember.findMany.mockResolvedValue([
        member('u1', 'Ada', Weekday.FRIDAY),
        member('u2', 'Bea', Weekday.SATURDAY),
      ]);

      const result = await service.getProjectReport(
        PROJECT_ID,
        ACTOR_ID,
        Role.ADMIN,
        RANGE,
      );

      // (4 + 5) / 2 = 4.5
      expect(result.workingDays.average).toBe(4.5);
      expect(result.workingDays.min).toBe(4);
      expect(result.workingDays.max).toBe(5);
    });

    it('is null across average/min/max, with an empty byMember, when nobody is currently staffed', async () => {
      prisma.projectMember.findMany.mockResolvedValue([]);

      const result = await service.getProjectReport(
        PROJECT_ID,
        ACTOR_ID,
        Role.ADMIN,
        RANGE,
      );

      expect(result.workingDays).toEqual({
        average: null,
        min: null,
        max: null,
        byMember: [],
      });
    });
  });

  describe('planningCoverageRate: divides by workingDays.average', () => {
    it('divides daysPlanned by the average, not a raw member count', async () => {
      // Two Saturday-off members over the Mon-Fri range: 5 working days
      // each, so the average is exactly 5.
      prisma.projectMember.findMany.mockResolvedValue([
        member('u1', 'Ada', Weekday.SATURDAY),
        member('u2', 'Bea', Weekday.SATURDAY),
      ]);
      prisma.dailyProjectEntry.findMany.mockResolvedValue([
        { dailyWorkReport: { status: DailyWorkReportStatus.PLAN_SUBMITTED } },
        { dailyWorkReport: { status: DailyWorkReportStatus.PLAN_SUBMITTED } },
        { dailyWorkReport: { status: DailyWorkReportStatus.COMPLETED } },
        { dailyWorkReport: { status: DailyWorkReportStatus.COMPLETED } },
      ]);

      const result = await service.getProjectReport(
        PROJECT_ID,
        ACTOR_ID,
        Role.ADMIN,
        RANGE,
      );

      expect(result.dailyWorkReportCompliance.daysPlanned).toBe(4);
      expect(result.workingDays.average).toBe(5);
      // 4 / 5 = 0.8
      expect(result.dailyWorkReportCompliance.planningCoverageRate).toBe(0.8);
    });

    it('is null, not a division error or 0, when the average is exactly 0', async () => {
      // A single Friday, both members Friday-off: every member reads 0
      // working days, so the average is 0, even though daysPlanned > 0.
      const singleFriday = { startDate: '2026-08-21', endDate: '2026-08-21' };
      prisma.projectMember.findMany.mockResolvedValue([
        member('u1', 'Ada', Weekday.FRIDAY),
        member('u2', 'Bea', Weekday.FRIDAY),
      ]);
      prisma.dailyProjectEntry.findMany.mockResolvedValue([
        { dailyWorkReport: { status: DailyWorkReportStatus.PLAN_SUBMITTED } },
      ]);

      const result = await service.getProjectReport(
        PROJECT_ID,
        ACTOR_ID,
        Role.ADMIN,
        singleFriday,
      );

      expect(result.workingDays.average).toBe(0);
      expect(result.dailyWorkReportCompliance.daysPlanned).toBe(1);
      expect(result.dailyWorkReportCompliance.planningCoverageRate).toBeNull();
    });

    it('is null when the average is null because there are no active members', async () => {
      prisma.projectMember.findMany.mockResolvedValue([]);

      const result = await service.getProjectReport(
        PROJECT_ID,
        ACTOR_ID,
        Role.ADMIN,
        RANGE,
      );

      expect(result.workingDays.average).toBeNull();
      expect(result.dailyWorkReportCompliance.planningCoverageRate).toBeNull();
    });
  });

  describe('project not found', () => {
    it('throws NotFoundException before touching membership or scope', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.getProjectReport(PROJECT_ID, ACTOR_ID, Role.ADMIN, RANGE),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(projectScope.assertActiveMember).not.toHaveBeenCalled();
    });
  });
});
