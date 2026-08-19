import { Test } from '@nestjs/testing';

import { PrismaService } from '@/prisma/prisma.service';

import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  const prisma = {
    auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AuditLogService);
  });

  describe('log', () => {
    it('writes the entry exactly as given', () => {
      prisma.auditLog.create.mockResolvedValue({ id: 'a1' });
      const entry = {
        userId: 'u1',
        action: 'user.deleted',
        targetType: 'User',
        targetId: 'u2',
        metadata: { reason: 'left the company' },
      };
      void service.log(entry);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: entry });
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
    });

    function whereOf() {
      return (prisma.auditLog.findMany.mock.calls[0][0] as { where: object })
        .where;
    }

    it('applies no filter at all when none is given', async () => {
      await service.findAll({});
      // An empty object, not `undefined` fields: a `targetType: undefined` in
      // a Prisma where is ignored, but building it explicitly keeps the query
      // readable and the intent obvious.
      expect(whereOf()).toEqual({});
    });

    it.each([
      ['targetType', { targetType: 'Project' }],
      ['targetId', { targetId: 'p1' }],
      ['userId', { userId: 'u1' }],
    ])('filters by %s alone', async (_name, filter) => {
      await service.findAll(filter);
      expect(whereOf()).toEqual(filter);
    });

    it('combines every filter, rather than letting the last one win', async () => {
      await service.findAll({
        targetType: 'Project',
        targetId: 'p1',
        userId: 'u1',
      });
      expect(whereOf()).toEqual({
        targetType: 'Project',
        targetId: 'p1',
        userId: 'u1',
      });
    });

    it('orders newest first, which is the only useful order for a log', async () => {
      await service.findAll({});
      expect(
        (prisma.auditLog.findMany.mock.calls[0][0] as { orderBy: object })
          .orderBy,
      ).toEqual({ createdAt: 'desc' });
    });

    it('includes the actor, so a reader is not left with a bare id', async () => {
      await service.findAll({});
      expect(
        (prisma.auditLog.findMany.mock.calls[0][0] as { include: object })
          .include,
      ).toEqual({ user: { select: { id: true, name: true, email: true } } });
    });

    it('counts against the SAME filter it lists with', async () => {
      // The bug this prevents: a total that describes a different query from
      // the page, so a list of 3 rows reports 400 results.
      await service.findAll({ targetType: 'Project' });
      const countArg = prisma.auditLog.count.mock.calls[0][0] as {
        where: object;
      };
      expect(countArg.where).toEqual(whereOf());
    });

    it('defaults to page 1 and a page size of 20', async () => {
      await service.findAll({});
      const args = prisma.auditLog.findMany.mock.calls[0][0] as {
        skip?: number;
        take?: number;
      };
      expect(args.skip).toBe(0);
      expect(args.take).toBe(20);
    });

    it('skips by page', async () => {
      await service.findAll({ page: 3, pageSize: 10 });
      const args = prisma.auditLog.findMany.mock.calls[0][0] as {
        skip?: number;
      };
      expect(args.skip).toBe(20);
    });
  });
});
