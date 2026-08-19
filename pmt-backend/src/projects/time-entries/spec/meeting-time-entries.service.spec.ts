/**
 * Unit tests for meeting time tracking.
 *
 * PrismaService and ProjectTimeEntriesService are mocked. No database.
 *
 * The invariant worth pinning: only one timer of ANY kind may run per person,
 * across both TimeEntry and MeetingTimeEntry. This service enforces its half by
 * calling into ProjectTimeEntriesService, one directionally, so the project
 * side's real side effects stay in one place.
 */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TimeEntryStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectTimeEntriesService } from '@/projects/time-entries/project/project-time-entries.service';
import { MeetingTimeEntriesService } from '@/projects/time-entries/meeting/meeting-time-entries.service';

const USER_ID = 'dev-1';

describe('MeetingTimeEntriesService', () => {
  let service: MeetingTimeEntriesService;
  let prisma: any;
  let projectTimeEntries: { assertNoRunningProjectTimer: jest.Mock };

  beforeEach(async () => {
    prisma = {
      meetingTimeEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ ...data, user: { id: USER_ID, name: 'Dev' } }),
          ),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'm1',
            ...data,
            user: { id: USER_ID, name: 'Dev' },
          }),
        ),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: USER_ID, name: 'Dev' }),
      },
    };
    projectTimeEntries = {
      assertNoRunningProjectTimer: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingTimeEntriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectTimeEntriesService, useValue: projectTimeEntries },
      ],
    }).compile();

    service = module.get(MeetingTimeEntriesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('start', () => {
    it('starts a meeting timer when nothing is running', async () => {
      const entry = await service.start({}, USER_ID);
      expect(entry).toMatchObject({
        userId: USER_ID,
        // A display object now, not a bare enum (ADR 0001).
        status: {
          value: TimeEntryStatus.RUNNING,
          label: 'Running',
          tone: 'success',
        },
      });
      expect(entry.capabilities).toEqual({
        canPause: true,
        canResume: false,
        canStop: true,
      });
    });

    it('makes the first segment its own session', async () => {
      await service.start({}, USER_ID);
      const { data } = prisma.meetingTimeEntry.create.mock.calls[0][0];
      expect(data.sessionId).toBe(data.id);
    });

    it('checks the PROJECT side too, because the rule spans both tables', async () => {
      // Without this call a person could run a project timer and a meeting
      // timer at once and double count their day.
      await service.start({}, USER_ID);
      expect(
        projectTimeEntries.assertNoRunningProjectTimer,
      ).toHaveBeenCalledWith(USER_ID);
    });

    it('refuses to start when a project timer is already running', async () => {
      projectTimeEntries.assertNoRunningProjectTimer.mockRejectedValue(
        new ConflictException('You already have a timer running'),
      );
      await expect(service.start({}, USER_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.meetingTimeEntry.create).not.toHaveBeenCalled();
    });

    it('refuses to start a second MEETING timer', async () => {
      prisma.meetingTimeEntry.findFirst.mockResolvedValue({
        id: 'm-running',
        userId: USER_ID,
        status: TimeEntryStatus.RUNNING,
        startedAt: new Date(Date.now() - 60_000),
      });
      await expect(service.start({}, USER_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('pause and resume', () => {
    it('rejects pausing an entry that is not running', async () => {
      prisma.meetingTimeEntry.findUnique.mockResolvedValue({
        id: 'm1',
        userId: USER_ID,
        status: TimeEntryStatus.PAUSED,
        startedAt: new Date(),
        endedAt: new Date(),
        sessionId: 'm1',
      });
      await expect(service.pause('m1', {}, USER_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects resuming an entry that is not paused', async () => {
      prisma.meetingTimeEntry.findUnique.mockResolvedValue({
        id: 'm1',
        userId: USER_ID,
        status: TimeEntryStatus.STOPPED,
        startedAt: new Date(),
        endedAt: new Date(),
        sessionId: 'm1',
      });
      await expect(service.resume('m1', {}, USER_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
