import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@/prisma/prisma.service';

import { AuditLogService } from '../audit-log.service';

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

describe('AuditLogService.findAll: the new filters', () => {
  /**
   * Three filters shipped with the audit log screen and none of them had a test.
   * These assert the WHERE clause the service builds, because that is where the
   * rule lives: asserting the returned rows would pass against a mock that
   * ignores the clause entirely.
   */
  let service: AuditLogService;
  let prisma: { auditLog: { findMany: jest.Mock; count: jest.Mock } };

  const whereFrom = () =>
    (
      prisma.auditLog.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;

  beforeEach(async () => {
    prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AuditLogService);
  });

  it('matches an action exactly, never as a substring', async () => {
    // Audit actions are stable dotted strings. A `contains` would quietly
    // include `user.password_reset` when somebody asked for
    // `user.password_changed`.
    await service.findAll({ action: 'user.password_changed' });

    expect(whereFrom().action).toBe('user.password_changed');
  });

  it('reads a start date from the first instant of that day', async () => {
    await service.findAll({ startDate: '2026-08-01' });

    expect(whereFrom().createdAt).toEqual({
      gte: new Date('2026-08-01T00:00:00.000Z'),
    });
  });

  it('reads an end date to the LAST instant of that day', async () => {
    // The off-by-one this exists to catch: an `lte` on midnight drops
    // everything that happened during the day the reader asked for.
    await service.findAll({ endDate: '2026-08-31' });

    expect(whereFrom().createdAt).toEqual({
      lte: new Date('2026-08-31T23:59:59.999Z'),
    });
  });

  it('keeps both ends of a range in ONE clause', async () => {
    // Two separate `createdAt` keys would overwrite each other, and the
    // surviving one would silently widen the range to unbounded on that side.
    await service.findAll({ startDate: '2026-08-01', endDate: '2026-08-31' });

    expect(whereFrom().createdAt).toEqual({
      gte: new Date('2026-08-01T00:00:00.000Z'),
      lte: new Date('2026-08-31T23:59:59.999Z'),
    });
  });

  it('places no date clause when neither end was given', async () => {
    await service.findAll({});

    expect('createdAt' in whereFrom()).toBe(false);
  });

  it('combines every filter rather than letting one win', async () => {
    await service.findAll({
      action: 'user.updated',
      userId: 'actor-1',
      targetType: 'User',
      targetId: 'u-9',
      startDate: '2026-08-01',
    });

    expect(whereFrom()).toEqual({
      action: 'user.updated',
      userId: 'actor-1',
      targetType: 'User',
      targetId: 'u-9',
      createdAt: { gte: new Date('2026-08-01T00:00:00.000Z') },
    });
  });

  it('counts with the SAME clause it lists with', async () => {
    // Otherwise the pager reports a total for a different question than the
    // rows answer, and a filtered list shows pages that are empty.
    await service.findAll({ action: 'user.updated' });

    const listWhere = whereFrom();
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: listWhere });
  });

  it('maps the rows rather than returning raw database records', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        action: 'user.password_changed',
        targetType: 'User',
        targetId: 'u1',
        metadata: null,
        userId: null,
        createdAt: new Date('2026-08-19T14:32:00.000Z'),
        user: null,
      },
    ]);

    const result = await service.findAll({});

    // The defect: the service returned `paginate()`'s result untouched, so
    // `action` reached the screen as the raw dotted string with no label.
    expect(result.items[0].actionLabel).toBe('User password changed');
  });
});
