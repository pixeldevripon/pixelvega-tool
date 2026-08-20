/**
 * Unit tests for the one path that creates the root account on boot.
 *
 * PrismaService, better-auth and every collaborator are mocked. No database.
 *
 * There is exactly one SYSTEM_ADMIN in this system and no API route can ever
 * mint another, so if this service creates the wrong thing, or creates it twice,
 * or silently does nothing, the whole permission model has no root. Each case
 * below is one of those failures.
 */

// better-auth ships ESM that Jest's CJS transform cannot parse, and a unit test
// has no business loading the real auth library: signUpEmail is a collaborator,
// so it is mocked like every other one. jest.mock is hoisted, so the module is
// never evaluated.
jest.mock('@/auth/instance/auth.instance', () => ({
  auth: {
    api: {
      signUpEmail: jest.fn().mockResolvedValue({}),
      requestPasswordReset: jest.fn().mockResolvedValue({}),
    },
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Role, UserStatus } from '@prisma/client';
import { AuditLogService } from '@/audit-logs/audit-log.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ProfilesService } from '@/profiles/profiles.service';
import { auth } from '@/auth/instance/auth.instance';
import { SystemAdminBootstrapService } from '../system-admin-bootstrap.service';

const ROOT_ID = 'root-user-id';
const ENV_KEYS = ['ADMIN_EMAIL', 'ADMIN_NAME', 'ADMIN_PASSWORD'] as const;

const signUpEmail = auth.api.signUpEmail as unknown as jest.Mock;
const requestPasswordReset = auth.api
  .requestPasswordReset as unknown as jest.Mock;

describe('SystemAdminBootstrapService', () => {
  let service: SystemAdminBootstrapService;
  let prisma: {
    user: { count: jest.Mock; update: jest.Mock };
  };
  let profiles: { createForRole: jest.Mock };
  let auditLog: { log: jest.Mock };
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.ADMIN_EMAIL = 'root@pixelvega.com';
    process.env.ADMIN_NAME = 'Root Account';
    process.env.ADMIN_PASSWORD = 'a-real-root-password';

    prisma = {
      user: {
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({ id: ROOT_ID }),
      },
    };
    profiles = { createForRole: jest.fn().mockResolvedValue(undefined) };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemAdminBootstrapService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfilesService, useValue: profiles },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(SystemAdminBootstrapService);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    jest.clearAllMocks();
  });

  describe('on an empty database', () => {
    it('signs the account up with the password from the environment', async () => {
      await service.onApplicationBootstrap();

      // The VALUE matters, not the call: an invented password here is an account
      // nobody can sign in to, which is what this replaced.
      expect(signUpEmail).toHaveBeenCalledWith({
        body: {
          email: 'root@pixelvega.com',
          password: 'a-real-root-password',
          name: 'Root Account',
        },
      });
    });

    it('promotes the row to an ACTIVE, verified SYSTEM_ADMIN that is not asked to reset', async () => {
      await service.onApplicationBootstrap();

      // signUpEmail cannot write any of these: `input: false` on every
      // additional field is what stops a caller choosing their own role.
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'root@pixelvega.com' },
        data: {
          role: Role.SYSTEM_ADMIN,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          mustResetPassword: false,
        },
      });
    });

    it('gives the account an employee profile for its role', async () => {
      await service.onApplicationBootstrap();
      expect(profiles.createForRole).toHaveBeenCalledWith(
        ROOT_ID,
        Role.SYSTEM_ADMIN,
      );
    });

    it('records the creation in the audit log, flagged as a bootstrap', async () => {
      await service.onApplicationBootstrap();
      expect(auditLog.log).toHaveBeenCalledWith({
        action: 'user.created',
        targetType: 'User',
        targetId: ROOT_ID,
        metadata: {
          email: 'root@pixelvega.com',
          role: Role.SYSTEM_ADMIN,
          bootstrap: true,
        },
      });
    });

    it('sends no password reset email, because the password is already known', async () => {
      await service.onApplicationBootstrap();
      expect(requestPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('when it must do nothing', () => {
    it('creates no second root account once any user exists', async () => {
      prisma.user.count.mockResolvedValue(1);
      await service.onApplicationBootstrap();
      expect(signUpEmail).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it.each(ENV_KEYS)(
      'skips, without throwing, when %s is unset',
      async (key) => {
        delete process.env[key];
        // Never throws: this runs in onApplicationBootstrap, and a throw here
        // would stop the whole app from starting over a missing dev convenience.
        await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
        expect(signUpEmail).not.toHaveBeenCalled();
        // Not even counted: the check happens before the query.
        expect(prisma.user.count).not.toHaveBeenCalled();
      },
    );
  });
});
