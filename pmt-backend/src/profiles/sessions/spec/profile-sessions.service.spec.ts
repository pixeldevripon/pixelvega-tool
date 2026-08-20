import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '@/audit-logs/audit-log.service';
import { PrismaService } from '@/prisma/prisma.service';

import { ProfileSessionsService } from '../profile-sessions.service';

describe('ProfileSessionsService', () => {
  let service: ProfileSessionsService;

  const prisma = {
    session: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const auditLog = { log: jest.fn() };

  const CURRENT = 'tok-current';

  const row = (id: string, token: string) => ({
    id,
    token,
    ipAddress: '203.0.113.7',
    userAgent: null,
    createdAt: new Date('2026-08-19T14:32:00.000Z'),
    expiresAt: new Date('2026-09-19T14:32:00.000Z'),
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileSessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();
    service = moduleRef.get(ProfileSessionsService);
    prisma.session.findMany.mockResolvedValue([
      row('s1', CURRENT),
      row('s2', 'tok-other'),
    ]);
  });

  describe('findMine', () => {
    it('excludes expired sessions', async () => {
      // better-auth does not delete a session when it expires, so the table
      // holds months of dead rows. A security screen listing sessions that
      // cannot be used is one nobody can read a real intrusion off.
      await service.findMine('u1', CURRENT);
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', expiresAt: { gt: expect.any(Date) } },
        }),
      );
    });

    it('scopes to the caller and nobody else', async () => {
      await service.findMine('u1', CURRENT);
      const [args] = prisma.session.findMany.mock.calls[0] as [
        { where: { userId: string } },
      ];
      expect(args.where.userId).toBe('u1');
    });

    it('returns the newest first', async () => {
      await service.findMine('u1', CURRENT);
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('marks exactly one session as current', async () => {
      const result = await service.findMine('u1', CURRENT);
      expect(result.filter((session) => session.isCurrent)).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });
  });

  describe('revoke', () => {
    it("scopes the lookup to the caller, so another user's id 404s", async () => {
      // The userId in the where clause is the whole authorization story. A
      // fetch-then-check would leave a window, and a 404 that only fires after
      // the row is found confirms that it exists.
      prisma.session.findFirst.mockResolvedValue(null);
      await expect(
        service.revoke('u1', 'someone-elses', CURRENT),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: { id: 'someone-elses', userId: 'u1' },
        select: { id: true, token: true },
      });
      expect(prisma.session.delete).not.toHaveBeenCalled();
    });

    it('refuses to revoke the session making the request', async () => {
      prisma.session.findFirst.mockResolvedValue({ id: 's1', token: CURRENT });
      await expect(service.revoke('u1', 's1', CURRENT)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.session.delete).not.toHaveBeenCalled();
    });

    it('deletes another session and audits it', async () => {
      prisma.session.findFirst.mockResolvedValue({
        id: 's2',
        token: 'tok-other',
      });
      await service.revoke('u1', 's2', CURRENT);
      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: 's2' },
      });
      expect(auditLog.log).toHaveBeenCalledWith({
        userId: 'u1',
        action: 'session.revoked',
        targetType: 'Session',
        targetId: 's2',
      });
    });

    it('returns the remaining sessions, so the screen does not refetch', async () => {
      prisma.session.findFirst.mockResolvedValue({
        id: 's2',
        token: 'tok-other',
      });
      prisma.session.findMany.mockResolvedValue([row('s1', CURRENT)]);
      const result = await service.revoke('u1', 's2', CURRENT);
      expect(result).toHaveLength(1);
      expect(result[0].isCurrent).toBe(true);
    });
  });

  describe('revokeOthers', () => {
    it('keeps the session making the request', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });
      await service.revokeOthers('u1', CURRENT);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', token: { not: CURRENT } },
      });
    });

    it('writes the sentence itself, plural and all', async () => {
      // A client assembling this would be deriving a message from a count,
      // which is exactly the work D4 moves here.
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });
      await expect(service.revokeOthers('u1', CURRENT)).resolves.toEqual({
        revoked: 3,
        message: 'Signed out of 3 other devices.',
      });
    });

    it('says device, singular, for one', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });
      const result = await service.revokeOthers('u1', CURRENT);
      expect(result.message).toBe('Signed out of 1 other device.');
    });

    it('says nothing happened when nothing did, and writes no audit row', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 });
      const result = await service.revokeOthers('u1', CURRENT);
      expect(result.message).toBe('There were no other devices to sign out.');
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('records how many were revoked', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 2 });
      await service.revokeOthers('u1', CURRENT);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'session.revoked_others',
          metadata: { revoked: 2 },
        }),
      );
    });
  });
});
