/**
 * Unit tests for the user protection rules.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * These are the rules `@Roles()` cannot express, because they depend on the
 * TARGET user's current role rather than only on the caller's. That makes them
 * invisible from the route, enforced in one place, and exactly the kind of
 * thing that quietly regresses.
 */

// better-auth ships ESM that Jest's CJS transform cannot parse, and a unit
// test has no business loading the real auth library anyway: signUpEmail is a
// collaborator, so it is mocked like every other one. jest.mock is hoisted, so
// neither module is ever evaluated.
jest.mock('better-auth/node', () => ({ fromNodeHeaders: jest.fn() }));
jest.mock('@/auth/instance/auth.instance', () => ({
  auth: { api: { signUpEmail: jest.fn().mockResolvedValue({}) } },
}));

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, UserStatus } from '@prisma/client';
import { AuditLogService } from '@/audit-logs/audit-log.service';
import { MailService } from '@/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ProfilesService } from '@/profiles/profiles.service';
import { UsersService } from '../users.service';

const SYSTEM_ADMIN_ID = 'system-admin';
const ADMIN_ID = 'admin-1';
const OTHER_ADMIN_ID = 'admin-2';
const DEVELOPER_ID = 'dev-1';

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: DEVELOPER_ID,
    email: 'dev@pixelvega.com',
    name: 'Dev One',
    role: Role.DEVELOPER,
    status: 'ACTIVE',
    deletedAt: null,
    ...overrides,
  };
}

describe('UsersService: target specific protection rules', () => {
  let service: UsersService;
  let prisma: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user()),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) =>
            Promise.resolve({ ...user(), ...data }),
          ),
      },
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: { sendInvite: jest.fn() } },
        { provide: ProfilesService, useValue: { createForRole: jest.fn() } },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findOne', () => {
    it('throws 404 when the user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('filters out soft deleted users', async () => {
      await service.findOne(DEVELOPER_ID);
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  describe('update: nobody changes their own role', () => {
    it('rejects an actor changing their own role, even a SYSTEM_ADMIN', async () => {
      // Self promotion and self demotion are both blocked. The system admin is
      // not exempt: there is exactly one, and it must stay that way.
      prisma.user.findFirst.mockResolvedValue(
        user({ id: SYSTEM_ADMIN_ID, role: Role.SYSTEM_ADMIN }),
      );
      await expect(
        service.update(
          SYSTEM_ADMIN_ID,
          { role: Role.ADMIN },
          SYSTEM_ADMIN_ID,
          Role.SYSTEM_ADMIN,
        ),
      ).rejects.toThrow(/cannot change your own role/i);
    });

    it('allows an actor to change their own NON role fields', async () => {
      prisma.user.findFirst.mockResolvedValue(user({ id: DEVELOPER_ID }));
      await expect(
        service.update(
          DEVELOPER_ID,
          { name: 'New Name' },
          DEVELOPER_ID,
          Role.DEVELOPER,
        ),
      ).resolves.toBeDefined();
    });

    it('allows setting role to the value it already has, since nothing changes', async () => {
      prisma.user.findFirst.mockResolvedValue(
        user({ id: DEVELOPER_ID, role: Role.DEVELOPER }),
      );
      await expect(
        service.update(
          DEVELOPER_ID,
          { role: Role.DEVELOPER },
          DEVELOPER_ID,
          Role.DEVELOPER,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('update: the SYSTEM_ADMIN account', () => {
    it('cannot be modified by an ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(
        user({ id: SYSTEM_ADMIN_ID, role: Role.SYSTEM_ADMIN }),
      );
      await expect(
        service.update(
          SYSTEM_ADMIN_ID,
          { name: 'Hijacked' },
          ADMIN_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('can be modified by the SYSTEM_ADMIN themselves', async () => {
      prisma.user.findFirst.mockResolvedValue(
        user({ id: SYSTEM_ADMIN_ID, role: Role.SYSTEM_ADMIN }),
      );
      await expect(
        service.update(
          SYSTEM_ADMIN_ID,
          { name: 'New Name' },
          SYSTEM_ADMIN_ID,
          Role.SYSTEM_ADMIN,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('update: one ADMIN cannot edit another', () => {
    it('rejects an ADMIN editing a peer ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(
        user({ id: OTHER_ADMIN_ID, role: Role.ADMIN }),
      );
      await expect(
        service.update(
          OTHER_ADMIN_ID,
          { name: 'Changed' },
          ADMIN_ID,
          Role.ADMIN,
        ),
      ).rejects.toThrow(/only the system admin can modify an admin/i);
    });

    it('allows an ADMIN to edit THEMSELVES', async () => {
      prisma.user.findFirst.mockResolvedValue(
        user({ id: ADMIN_ID, role: Role.ADMIN }),
      );
      await expect(
        service.update(ADMIN_ID, { name: 'My New Name' }, ADMIN_ID, Role.ADMIN),
      ).resolves.toBeDefined();
    });

    it('allows the SYSTEM_ADMIN to edit an ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(
        user({ id: ADMIN_ID, role: Role.ADMIN }),
      );
      await expect(
        service.update(
          ADMIN_ID,
          { name: 'Renamed' },
          SYSTEM_ADMIN_ID,
          Role.SYSTEM_ADMIN,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('update: nobody is ever granted SYSTEM_ADMIN', () => {
    // This is the root role. The DTO's IsIn(ASSIGNABLE_ROLES) rejects it at
    // validation, but the service checks it too: the boundary must not rest on
    // one decorator that a later refactor could relax to @IsEnum(Role) without
    // realising what it was holding up. A phase 5 rewrite did exactly that,
    // which is why these tests exist.
    it.each([Role.SYSTEM_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER])(
      'rejects a %s actor granting SYSTEM_ADMIN',
      async (actorRole) => {
        await expect(
          service.update(
            DEVELOPER_ID,
            { role: Role.SYSTEM_ADMIN },
            'actor-1',
            actorRole,
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it('rejects an invite with role SYSTEM_ADMIN, even from the SYSTEM_ADMIN', async () => {
      await expect(
        service.invite(
          {
            email: 'root2@pixelvega.com',
            name: 'Second Root',
            role: Role.SYSTEM_ADMIN,
          },
          SYSTEM_ADMIN_ID,
          Role.SYSTEM_ADMIN,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('never reaches the database when SYSTEM_ADMIN is requested', async () => {
      await expect(
        service.update(
          DEVELOPER_ID,
          { role: Role.SYSTEM_ADMIN },
          ADMIN_ID,
          Role.ADMIN,
        ),
      ).rejects.toThrow();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('update: promotion to ADMIN', () => {
    it('rejects an ADMIN promoting someone to ADMIN', async () => {
      await expect(
        service.update(
          DEVELOPER_ID,
          { role: Role.ADMIN },
          ADMIN_ID,
          Role.ADMIN,
        ),
      ).rejects.toThrow(/only the system admin can promote/i);
    });

    it('allows the SYSTEM_ADMIN to promote someone to ADMIN', async () => {
      await expect(
        service.update(
          DEVELOPER_ID,
          { role: Role.ADMIN },
          SYSTEM_ADMIN_ID,
          Role.SYSTEM_ADMIN,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('update: audit logging', () => {
    it('logs user.updated with a from/to diff when something changed', async () => {
      await service.update(
        DEVELOPER_ID,
        { name: 'Renamed' },
        ADMIN_ID,
        Role.ADMIN,
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.updated',
          metadata: expect.objectContaining({
            changes: expect.objectContaining({
              name: { from: 'Dev One', to: 'Renamed' },
            }),
          }),
        }),
      );
    });

    it('writes NO audit row for a no-op update', async () => {
      // A PATCH that changes nothing is not an event worth recording.
      await service.update(
        DEVELOPER_ID,
        { name: 'Dev One' },
        ADMIN_ID,
        Role.ADMIN,
      );
      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('never deletes the SYSTEM_ADMIN, not even for the SYSTEM_ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(
        user({ id: SYSTEM_ADMIN_ID, role: Role.SYSTEM_ADMIN }),
      );
      await expect(
        service.remove(SYSTEM_ADMIN_ID, SYSTEM_ADMIN_ID, Role.SYSTEM_ADMIN),
      ).rejects.toThrow(/cannot be deleted/i);
    });

    it('rejects an ADMIN deleting a peer ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(
        user({ id: OTHER_ADMIN_ID, role: Role.ADMIN }),
      );
      await expect(
        service.remove(OTHER_ADMIN_ID, ADMIN_ID, Role.ADMIN),
      ).rejects.toThrow(/only the system admin can delete an admin/i);
    });

    it('soft deletes rather than removing the row', async () => {
      await service.remove(DEVELOPER_ID, ADMIN_ID, Role.ADMIN);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DEVELOPER_ID },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });

    it('logs user.deleted with the ACTOR as userId, not the target', async () => {
      await service.remove(DEVELOPER_ID, ADMIN_ID, Role.ADMIN);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.deleted',
          userId: ADMIN_ID,
          targetId: DEVELOPER_ID,
        }),
      );
    });
  });

  describe('invite', () => {
    it('rejects an ADMIN inviting another ADMIN', async () => {
      await expect(
        service.invite(
          { email: 'new@pixelvega.com', name: 'New', role: Role.ADMIN },
          ADMIN_ID,
          Role.ADMIN,
        ),
      ).rejects.toThrow(/only the system admin can invite an admin/i);
    });

    it('rejects a duplicate email with 409', async () => {
      prisma.user.findUnique.mockResolvedValue(user());
      await expect(
        service.invite(
          { email: 'dev@pixelvega.com', name: 'Dup', role: Role.DEVELOPER },
          ADMIN_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('checks the ADMIN rule BEFORE looking up the email', async () => {
      // Order matters: an ADMIN trying to invite an ADMIN should be told they
      // lack permission, not whether that email is already taken, which would
      // leak account existence to someone not entitled to ask.
      await expect(
        service.invite(
          { email: 'x@pixelvega.com', name: 'X', role: Role.ADMIN },
          ADMIN_ID,
          Role.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });
});

describe('UsersService.findAll: the list filters', () => {
  /**
   * `GET /users` took only `sortBy` and `sortOrder`, so the team screen had no
   * way to answer "who are the designers" except by paging 235 people. Three
   * filters were added and none had a test.
   *
   * These assert the WHERE clause, because that is where the rules live: a mock
   * that ignores the clause would satisfy any assertion about the rows.
   */
  let service: UsersService;
  let prisma: { user: { findMany: jest.Mock; count: jest.Mock } };

  const whereFrom = () =>
    (
      prisma.user.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: { sendMail: jest.fn() } },
        { provide: ProfilesService, useValue: { createForUser: jest.fn() } },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('always excludes soft deleted people', async () => {
    await service.findAll({});

    expect(whereFrom().deletedAt).toBeNull();
  });

  it('STILL excludes them with every filter applied', async () => {
    // `deletedAt: null` is not a filter and must never become one. A new filter
    // spreading over it would resurrect deleted accounts into the team list.
    await service.findAll({
      role: [Role.DEVELOPER],
      status: UserStatus.ACTIVE,
      search: 'ada',
    });

    expect(whereFrom().deletedAt).toBeNull();
  });

  it('matches ANY of several roles, not all of them', async () => {
    await service.findAll({ role: [Role.DEVELOPER, Role.DESIGNER] });

    expect(whereFrom().role).toEqual({ in: ['DEVELOPER', 'DESIGNER'] });
  });

  it('ignores an empty role array rather than matching nothing', async () => {
    // `{ in: [] }` matches no rows, so an empty array would silently empty the
    // list instead of being the no-op the caller meant.
    await service.findAll({ role: [] });

    expect('role' in whereFrom()).toBe(false);
  });

  it('searches the name OR the email, case insensitively', async () => {
    // One box for both, because a person looking for a colleague types
    // whichever of the two they remember.
    await service.findAll({ search: 'ada' });

    expect(whereFrom().OR).toEqual([
      { name: { contains: 'ada', mode: 'insensitive' } },
      { email: { contains: 'ada', mode: 'insensitive' } },
    ]);
  });

  it('places no filter that was not asked for', async () => {
    await service.findAll({});

    const where = whereFrom();
    expect('role' in where).toBe(false);
    expect('status' in where).toBe(false);
    expect('OR' in where).toBe(false);
  });

  it('sorts by name ascending by default', async () => {
    // Every screen that lists people reads them alphabetically.
    await service.findAll({});

    const call = prisma.user.findMany.mock.calls[0][0] as { orderBy: unknown };
    expect(call.orderBy).toEqual({ name: 'asc' });
  });

  it('counts with the SAME clause it lists with', async () => {
    await service.findAll({ status: UserStatus.SUSPENDED });

    expect(prisma.user.count).toHaveBeenCalledWith({ where: whereFrom() });
  });

  it('never selects the password column', async () => {
    // `User.password` holds a real hash.
    await service.findAll({});

    const call = prisma.user.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect('password' in call.select).toBe(false);
  });
});
