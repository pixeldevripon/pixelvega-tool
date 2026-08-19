/**
 * Unit tests for the "one active timer" invariant.
 *
 * PrismaService is fully mocked. No database connection is made.
 *
 * The rule is GLOBAL per user, not per project, and it spans two tables
 * (TimeEntry and MeetingTimeEntry). Both properties are easy to break with a
 * well meaning `where` clause change, and neither is visible from the route,
 * so they are pinned here.
 */

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, TimeEntryStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { ProjectScopeService } from '@/project-scope/project-scope.service';
import { ProjectTimeEntriesService } from './project-time-entries.service';

function createMockPrismaService() {
  return {
    project: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    projectMember: { findFirst: jest.fn() },
    timeEntry: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { durationMinutes: 0 } }),
    },
    meetingTimeEntry: { findFirst: jest.fn(), update: jest.fn() },
  };
}

const DEVELOPER_ID = 'dev-1';
const PROJECT_A = 'project-a';
const PROJECT_B = 'project-b';

describe('ProjectTimeEntriesService: the one active timer rule', () => {
  let service: ProjectTimeEntriesService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let projectActivity: { log: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    projectActivity = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectScopeService,
        ProjectTimeEntriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectActivityService, useValue: projectActivity },
      ],
    }).compile();

    service = module.get(ProjectTimeEntriesService);

    // Default happy path: the project exists, the caller is staffed on it,
    // and nothing is running anywhere.
    prisma.project.findFirst.mockResolvedValue({ id: PROJECT_A });
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_A });
    prisma.projectMember.findFirst.mockResolvedValue({ id: 'member-1' });
    prisma.timeEntry.findFirst.mockResolvedValue(null);
    prisma.meetingTimeEntry.findFirst.mockResolvedValue(null);
    prisma.timeEntry.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ ...data, user: { id: DEVELOPER_ID, name: 'Dev One' } }),
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('when nothing is running', () => {
    it('starts a timer', async () => {
      const entry = await service.start(
        PROJECT_A,
        {},
        DEVELOPER_ID,
        Role.DEVELOPER,
      );
      expect(prisma.timeEntry.create).toHaveBeenCalledTimes(1);
      expect(entry).toMatchObject({
        projectId: PROJECT_A,
        userId: DEVELOPER_ID,
        status: TimeEntryStatus.RUNNING,
      });
    });

    it('makes the first segment its own session, so resumes can be chained to it', async () => {
      await service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER);
      const { data } = prisma.timeEntry.create.mock.calls[0][0];
      expect(data.sessionId).toBe(data.id);
    });

    it('logs a TIME_STARTED activity', async () => {
      await service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER);
      expect(projectActivity.log).toHaveBeenCalledWith(
        PROJECT_A,
        DEVELOPER_ID,
        'TIME_STARTED',
        expect.any(Object),
      );
    });
  });

  describe('when a project timer is already running', () => {
    beforeEach(() => {
      // Started a minute ago, so it is nowhere near its auto stop cutoff.
      prisma.timeEntry.findFirst.mockResolvedValue({
        id: 'running-1',
        projectId: PROJECT_B,
        userId: DEVELOPER_ID,
        status: TimeEntryStatus.RUNNING,
        startedAt: new Date(Date.now() - 60_000),
      });
    });

    it('rejects a second start with 409', async () => {
      await expect(
        service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.timeEntry.create).not.toHaveBeenCalled();
    });

    it('rejects it even though the running timer is on a DIFFERENT project', async () => {
      // The rule is global per user. A per project check would let one person
      // accrue two concurrent timers and double count their hours.
      await expect(
        service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER),
      ).rejects.toThrow(/already have a timer running/i);
    });

    it('names the project the existing timer is on, so the user can go stop it', async () => {
      await expect(
        service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER),
      ).rejects.toThrow(new RegExp(PROJECT_B));
    });

    it('looks for the running timer by user alone, never scoped to a project', async () => {
      // This is the assertion that catches someone "optimising" the guard by
      // adding projectId to the where clause.
      await expect(
        service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER),
      ).rejects.toBeInstanceOf(ConflictException);

      const guardCall = prisma.timeEntry.findFirst.mock.calls.find(
        ([arg]) => arg?.where?.status === TimeEntryStatus.RUNNING,
      );
      expect(guardCall).toBeDefined();
      expect(guardCall![0].where).toEqual({
        userId: DEVELOPER_ID,
        status: TimeEntryStatus.RUNNING,
      });
      expect(guardCall![0].where).not.toHaveProperty('projectId');
    });
  });

  describe('when the running timer has already expired', () => {
    it('auto stops the stale one and lets the new start through', async () => {
      // Started well over the nine hour cap and on an earlier UTC day, so the
      // cutoff is firmly in the past. A forgotten timer must not permanently
      // block the user from tracking time.
      prisma.timeEntry.findFirst.mockResolvedValue({
        id: 'stale-1',
        projectId: PROJECT_B,
        userId: DEVELOPER_ID,
        status: TimeEntryStatus.RUNNING,
        startedAt: new Date('2020-01-01T09:00:00Z'),
      });
      // autoStopIfExpired re-reads the row WITH its user relation to build the
      // activity message, so the mock must return that shape.
      prisma.timeEntry.update.mockResolvedValue({
        id: 'stale-1',
        projectId: PROJECT_B,
        startedAt: new Date('2020-01-01T09:00:00Z'),
        user: { id: DEVELOPER_ID, name: 'Dev One' },
      });

      await service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER);

      expect(prisma.timeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stale-1' },
          data: expect.objectContaining({ status: TimeEntryStatus.STOPPED }),
        }),
      );
      expect(prisma.timeEntry.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a MEETING timer is running', () => {
    it('rejects a project timer start, because the rule spans both tables', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue(null);
      prisma.meetingTimeEntry.findFirst.mockResolvedValue({
        id: 'meeting-1',
        userId: DEVELOPER_ID,
        status: TimeEntryStatus.RUNNING,
        startedAt: new Date(Date.now() - 60_000),
      });

      await expect(
        service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER),
      ).rejects.toThrow(/meeting timer running/i);
      expect(prisma.timeEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('project membership', () => {
    it('rejects a DEVELOPER who is not an active member with 403', async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a DESIGNER who is not an active member with 403', async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DESIGNER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does not require membership of an ADMIN', async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.start(PROJECT_A, {}, 'admin-1', Role.ADMIN),
      ).resolves.toBeDefined();
    });

    it('checks membership BEFORE the running timer guard', async () => {
      // Order matters for the error a caller sees: a non member should be told
      // they lack access, not that they have a timer running elsewhere.
      prisma.projectMember.findFirst.mockResolvedValue(null);
      prisma.timeEntry.findFirst.mockResolvedValue({
        id: 'running-1',
        projectId: PROJECT_B,
        userId: DEVELOPER_ID,
        status: TimeEntryStatus.RUNNING,
        startedAt: new Date(Date.now() - 60_000),
      });
      await expect(
        service.start(PROJECT_A, {}, DEVELOPER_ID, Role.DEVELOPER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
