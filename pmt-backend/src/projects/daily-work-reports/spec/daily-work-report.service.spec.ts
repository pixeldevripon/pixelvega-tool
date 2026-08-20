/**
 * Unit tests for the daily work report edit windows.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * Two INDEPENDENT windows, easy to conflate:
 *   - the plan is editable until wrap up is submitted, with no time limit
 *   - the wrap up is editable for two hours after submission, then locked
 * They are separate predicates and must stay that way.
 */

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DailyWorkReportStatus, Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/projects/activity/project-activity.service';
import { SlackService } from '@/slack/slack.service';
import { ProjectScopeService } from '@/projects/scope/project-scope.service';
import { DailyWorkReportService } from '@/projects/daily-work-reports/daily-work-report.service';

const REPORT_ID = 'report-1';
const OWNER_ID = 'dev-1';
const OTHER_ID = 'dev-2';
const TWO_HOURS = 2 * 60 * 60 * 1000;

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    userId: OWNER_ID,
    date: new Date('2026-06-01'),
    status: DailyWorkReportStatus.PLAN_SUBMITTED,
    wrapUpSubmittedAt: null,
    planFeedSlackTs: null,
    wrapUpFeedSlackTs: null,
    entries: [],
    user: { id: OWNER_ID, name: 'Dev One' },
    ...overrides,
  };
}

describe('DailyWorkReportService: the two edit windows', () => {
  let service: DailyWorkReportService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      dailyWorkReport: {
        findUnique: jest.fn().mockResolvedValue(report()),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(report()),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ ...report(), ...data }),
          ),
      },
      dailyProjectEntry: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
      },
      project: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'p1', slackChannelId: null }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      projectMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: OWNER_ID, name: 'Dev One' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectScopeService,
        DailyWorkReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectActivityService, useValue: { log: jest.fn() } },
        {
          provide: SlackService,
          useValue: { postMessage: jest.fn(), updateMessage: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(DailyWorkReportService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('ownership', () => {
    it('rejects editing someone else report', async () => {
      await expect(
        service.updatePlan(REPORT_ID, OTHER_ID, { entries: [] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws 404 for a report that does not exist', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePlan(REPORT_ID, OWNER_ID, { entries: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('the plan window is state based, with no time limit', () => {
    it('allows editing while the report is still PLAN_SUBMITTED', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({ status: DailyWorkReportStatus.PLAN_SUBMITTED }),
      );
      await expect(
        service.updatePlan(REPORT_ID, OWNER_ID, { entries: [] }),
      ).resolves.toBeDefined();
    });

    it('allows editing a plan submitted long ago, since there is no clock on it', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({
          status: DailyWorkReportStatus.PLAN_SUBMITTED,
          date: new Date('2020-01-01'),
        }),
      );
      await expect(
        service.updatePlan(REPORT_ID, OWNER_ID, { entries: [] }),
      ).resolves.toBeDefined();
    });

    it('locks the plan once wrap up is submitted', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({
          status: DailyWorkReportStatus.COMPLETED,
          wrapUpSubmittedAt: new Date(),
        }),
      );
      await expect(
        service.updatePlan(REPORT_ID, OWNER_ID, { entries: [] }),
      ).rejects.toThrow(/plan locked/i);
    });
  });

  describe('the wrap up window is time based', () => {
    it('allows editing within two hours of submission', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({
          status: DailyWorkReportStatus.COMPLETED,
          wrapUpSubmittedAt: new Date(Date.now() - 60 * 60 * 1000),
        }),
      );
      await expect(
        service.updateWrapUp(REPORT_ID, OWNER_ID, { entries: [] }),
      ).resolves.toBeDefined();
    });

    it('locks it after two hours, for audit', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({
          status: DailyWorkReportStatus.COMPLETED,
          wrapUpSubmittedAt: new Date(Date.now() - TWO_HOURS - 60_000),
        }),
      );
      await expect(
        service.updateWrapUp(REPORT_ID, OWNER_ID, { entries: [] }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects editing a wrap up that was never submitted', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({
          status: DailyWorkReportStatus.PLAN_SUBMITTED,
          wrapUpSubmittedAt: null,
        }),
      );
      await expect(
        service.updateWrapUp(REPORT_ID, OWNER_ID, { entries: [] }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('the two windows are independent', () => {
    it('a locked plan does not imply a locked wrap up', async () => {
      // PLAN_SUBMITTED -> COMPLETED locks the plan, but the wrap up is still
      // inside its own two hour window.
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({
          status: DailyWorkReportStatus.COMPLETED,
          wrapUpSubmittedAt: new Date(Date.now() - 1000),
        }),
      );
      await expect(
        service.updatePlan(REPORT_ID, OWNER_ID, { entries: [] }),
      ).rejects.toThrow();
      await expect(
        service.updateWrapUp(REPORT_ID, OWNER_ID, { entries: [] }),
      ).resolves.toBeDefined();
    });

    it('an editable plan does not imply an editable wrap up', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({
          status: DailyWorkReportStatus.PLAN_SUBMITTED,
          wrapUpSubmittedAt: null,
        }),
      );
      await expect(
        service.updatePlan(REPORT_ID, OWNER_ID, { entries: [] }),
      ).resolves.toBeDefined();
      await expect(
        service.updateWrapUp(REPORT_ID, OWNER_ID, { entries: [] }),
      ).rejects.toThrow();
    });
  });

  describe('a plan is mandatory before wrap up', () => {
    it('rejects a wrap up on a report that was never planned', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({ status: DailyWorkReportStatus.COMPLETED }),
      );
      await expect(
        service.submitWrapUp(REPORT_ID, OWNER_ID, { entries: [] }),
      ).rejects.toThrow(/must submit plan before/i);
    });

    it('accepts a wrap up once the plan is in', async () => {
      prisma.dailyWorkReport.findUnique.mockResolvedValue(
        report({ status: DailyWorkReportStatus.PLAN_SUBMITTED }),
      );
      await expect(
        service.submitWrapUp(REPORT_ID, OWNER_ID, { entries: [] }),
      ).resolves.toBeDefined();
    });
  });

  describe('findByProject: canReview is assembled from the real scope check', () => {
    // The mapper's `canReview` logic is covered exhaustively in
    // daily-work-report.mapper.spec.ts. What was NOT covered is the wiring:
    // that the service actually asks ProjectScopeService which projects the
    // caller manages and threads the answer into the mapper. Without this, the
    // whole `managedProjectIds` mechanism could be deleted and the mapper specs
    // would still pass.
    const ENTRY_AUTHOR = 'author-1';
    const REVIEWER = 'pm-1';

    function entry() {
      return {
        id: 'e1',
        dailyWorkReportId: 'r1',
        projectId: 'p1',
        plan: 'Ship it',
        accomplishments: null,
        reviewedAt: null,
        reviewComment: null,
        reviewedBy: null,
        project: { id: 'p1', name: 'Acme corporate site' },
        dailyWorkReport: {
          date: new Date('2026-08-19T00:00:00.000Z'),
          userId: ENTRY_AUTHOR,
          user: {
            id: ENTRY_AUTHOR,
            name: 'Dev One',
            email: 'dev@pixelvega.com',
          },
        },
      };
    }

    beforeEach(() => {
      prisma.dailyProjectEntry.findMany.mockResolvedValue([entry()]);
      prisma.dailyProjectEntry.count.mockResolvedValue(1);
    });

    it('offers a review to a PROJECT_MANAGER who manages the project', async () => {
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'm1' });

      const result = await service.findByProject(
        'p1',
        {},
        REVIEWER,
        Role.PROJECT_MANAGER,
      );

      expect(result.items[0].capabilities.canReview).toBe(true);
    });

    it('offers none to a PROJECT_MANAGER who does not', async () => {
      // Reaching the listing needs only a read; reviewing needs the project.
      prisma.projectMember.findFirst.mockResolvedValue(null);

      const result = await service.findByProject(
        'p1',
        {},
        REVIEWER,
        Role.PROJECT_MANAGER,
      );

      expect(result.items[0].capabilities.canReview).toBe(false);
    });

    it('offers none to the author, even where they manage the project', async () => {
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'm1' });

      const result = await service.findByProject(
        'p1',
        {},
        ENTRY_AUTHOR,
        Role.PROJECT_MANAGER,
      );

      expect(result.items[0].capabilities.canReview).toBe(false);
    });

    it('asks the scope question once for the whole page, not once per entry', async () => {
      prisma.dailyProjectEntry.findMany.mockResolvedValue([
        entry(),
        { ...entry(), id: 'e2' },
        { ...entry(), id: 'e3' },
      ]);
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'm1' });

      await service.findByProject('p1', {}, REVIEWER, Role.PROJECT_MANAGER);

      // Three entries, one project, one membership lookup for the review
      // question. The read guard asks its own separate question first.
      const reviewLookups = prisma.projectMember.findFirst.mock.calls.filter(
        ([args]: [{ where: { role?: string } }]) => args.where.role,
      );
      expect(reviewLookups).toHaveLength(1);
    });
  });
});
