/**
 * Unit tests for leave balance bookkeeping.
 *
 * PrismaService is mocked. No database connection.
 *
 * Balance rows are lazy get-or-create keyed on (userId, leaveTypeId, year).
 * There is no cron job and no year end carry forward: the row appears the
 * first time it is read or incremented, seeded from the leave type's default.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { LeaveBalancesService } from './leave-balances.service';

const USER_ID = 'dev-1';
const TYPE_ID = 'annual';
const YEAR = 2026;

describe('LeaveBalancesService', () => {
  let service: LeaveBalancesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      leaveBalance: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'bal-1', usedDays: 0, ...data }),
          ),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'bal-1', ...data }),
          ),
      },
      leaveType: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: TYPE_ID, defaultDaysPerYear: 20 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveBalancesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LeaveBalancesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrCreate', () => {
    it('returns the existing row without creating a second one', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        usedDays: 5,
      });
      const result = await service.getOrCreate(USER_ID, TYPE_ID, YEAR);
      expect(result).toMatchObject({ id: 'bal-1', usedDays: 5 });
      expect(prisma.leaveBalance.create).not.toHaveBeenCalled();
    });

    it('creates the row seeded from the leave type default when absent', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue(null);
      await service.getOrCreate(USER_ID, TYPE_ID, YEAR);
      expect(prisma.leaveBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: USER_ID,
            leaveTypeId: TYPE_ID,
            year: YEAR,
            allocatedDays: 20,
          },
        }),
      );
    });

    it('looks the row up on the composite key, so a year is its own balance', async () => {
      // No carry forward: 2027 starts fresh rather than inheriting 2026.
      prisma.leaveBalance.findUnique.mockResolvedValue(null);
      await service.getOrCreate(USER_ID, TYPE_ID, YEAR);
      expect(prisma.leaveBalance.findUnique).toHaveBeenCalledWith({
        where: {
          userId_leaveTypeId_year: {
            userId: USER_ID,
            leaveTypeId: TYPE_ID,
            year: YEAR,
          },
        },
      });
    });
  });

  describe('incrementUsedDays', () => {
    it('adds onto the existing usedDays rather than replacing it', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        usedDays: 5,
      });
      await service.incrementUsedDays(USER_ID, TYPE_ID, YEAR, 3);
      expect(prisma.leaveBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bal-1' },
          data: { usedDays: 8 },
        }),
      );
    });

    it('creates the balance first when there is none yet', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue(null);
      await service.incrementUsedDays(USER_ID, TYPE_ID, YEAR, 4);
      expect(prisma.leaveBalance.create).toHaveBeenCalled();
      expect(prisma.leaveBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { usedDays: 4 } }),
      );
    });

    it('allows usedDays to exceed the allocation', async () => {
      // Balance is a record, not a gate: approval never checks it, so an
      // over-allocation is representable and visible rather than rejected.
      prisma.leaveBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        usedDays: 19,
        allocatedDays: 20,
      });
      await service.incrementUsedDays(USER_ID, TYPE_ID, YEAR, 5);
      expect(prisma.leaveBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { usedDays: 24 } }),
      );
    });
  });
});
