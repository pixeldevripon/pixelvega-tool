import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole, Role } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

import { ProjectScopeService } from './project-scope.service';

describe('ProjectScopeService', () => {
  let service: ProjectScopeService;
  const prisma = {
    projectMember: { findFirst: jest.fn() },
    project: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ProjectScopeService);
  });

  describe('isActiveMember', () => {
    it('is true only for a membership that has not ended', () => {
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'm1' });
      return expect(service.isActiveMember('p1', 'u1')).resolves.toBe(true);
    });

    it('queries with leftAt null, so a departed member is not active', async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(service.isActiveMember('p1', 'u1')).resolves.toBe(false);
      expect(prisma.projectMember.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'p1', userId: 'u1', leftAt: null },
        select: { id: true },
      });
    });
  });

  describe('managesProject', () => {
    it.each([Role.ADMIN, Role.SYSTEM_ADMIN])(
      '%s manages every project without a staffing check',
      async (role) => {
        await expect(service.managesProject('p1', 'u1', role)).resolves.toBe(
          true,
        );
        // The important half: no query at all. An admin who is not staffed on
        // the project must still pass, so asking the database would be wrong as
        // well as wasteful.
        expect(prisma.projectMember.findFirst).not.toHaveBeenCalled();
      },
    );

    it('requires a PROJECT_MANAGER holding the PROJECT_MANAGER role ON THIS project', async () => {
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'm1' });
      await expect(
        service.managesProject('p1', 'u1', Role.PROJECT_MANAGER),
      ).resolves.toBe(true);
      expect(prisma.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'p1',
          userId: 'u1',
          role: ProjectRole.PROJECT_MANAGER,
          leftAt: null,
        },
        select: { id: true },
      });
    });

    it('is false for a PROJECT_MANAGER not staffed on this project', () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      // Having the role is not having the project. This is the rule the seven
      // duplicated copies existed to enforce.
      return expect(
        service.managesProject('p1', 'u1', Role.PROJECT_MANAGER),
      ).resolves.toBe(false);
    });

    it('is false for a DEVELOPER staffed only as a DEVELOPER', () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      return expect(
        service.managesProject('p1', 'u1', Role.DEVELOPER),
      ).resolves.toBe(false);
    });
  });

  describe('isScopedByMembership', () => {
    it.each([
      [Role.DEVELOPER, true],
      [Role.DESIGNER, true],
      [Role.PROJECT_MANAGER, false],
      [Role.ADMIN, false],
      [Role.SYSTEM_ADMIN, false],
      [Role.CLIENT, false],
    ])('%s -> %s', (role, expected) => {
      expect(service.isScopedByMembership(role)).toBe(expected);
    });
  });

  describe('assertActiveMember', () => {
    it.each([Role.PROJECT_MANAGER, Role.ADMIN, Role.SYSTEM_ADMIN, Role.CLIENT])(
      'is a no-op for %s and issues no query',
      async (role) => {
        await expect(
          service.assertActiveMember('p1', 'u1', role),
        ).resolves.toBeUndefined();
        expect(prisma.projectMember.findFirst).not.toHaveBeenCalled();
      },
    );

    it.each([Role.DEVELOPER, Role.DESIGNER])(
      'throws for an unstaffed %s',
      async (role) => {
        prisma.projectMember.findFirst.mockResolvedValue(null);
        await expect(
          service.assertActiveMember('p1', 'u1', role),
        ).rejects.toThrow(ForbiddenException);
      },
    );

    it('passes for a staffed DEVELOPER', () => {
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'm1' });
      return expect(
        service.assertActiveMember('p1', 'u1', Role.DEVELOPER),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertManagesProject', () => {
    it('throws with a message naming the reason', async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.assertManagesProject('p1', 'u1', Role.PROJECT_MANAGER),
      ).rejects.toThrow('You do not manage this project');
    });

    it('passes for ADMIN', () => {
      return expect(
        service.assertManagesProject('p1', 'u1', Role.ADMIN),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertStaffedOnProject', () => {
    it('404s on a project that does not exist, before any authorization answer', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(
        service.assertStaffedOnProject('nope', 'u1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.projectMember.findFirst).not.toHaveBeenCalled();
    });

    it('requires membership of EVERY role, admins included', async () => {
      // The rule that made this a separate method rather than a fifth copy of
      // assertActiveMember: to log work against a project you must be staffed
      // on it, and being an admin is not a reason to appear on its timesheet.
      prisma.project.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.assertStaffedOnProject('p1', 'admin-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('passes for a staffed user', () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'm1' });
      return expect(
        service.assertStaffedOnProject('p1', 'u1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('the predicates and the assertions cannot disagree', () => {
    it.each([
      [Role.DEVELOPER, null, false],
      [Role.DEVELOPER, { id: 'm1' }, true],
      [Role.PROJECT_MANAGER, null, false],
      [Role.PROJECT_MANAGER, { id: 'm1' }, true],
    ])(
      'managesProject(%s) agreeing with assertManagesProject',
      async (role, membership, expected) => {
        // ADR 0002: a capability flag says a button is safe to show, and the
        // assertion decides whether it works. They are derived from the same
        // predicate here so that a UI cannot offer an action that 403s.
        prisma.projectMember.findFirst.mockResolvedValue(membership);
        const allowed = await service.managesProject('p1', 'u1', role);
        expect(allowed).toBe(expected);

        prisma.projectMember.findFirst.mockResolvedValue(membership);
        const assertion = service.assertManagesProject('p1', 'u1', role);
        if (expected) await expect(assertion).resolves.toBeUndefined();
        else await expect(assertion).rejects.toThrow(ForbiddenException);
      },
    );
  });
});
