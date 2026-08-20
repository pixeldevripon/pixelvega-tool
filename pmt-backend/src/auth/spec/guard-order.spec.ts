/**
 * The global guard chain, asserted as an ORDER rather than as a set.
 *
 * Getting this wrong does not fail at boot. PermissionsGuard registered ahead of
 * AuthGuard answered 401 to every authenticated request, because it ran before
 * a session had been resolved and found no `request.user`. Every route was
 * affected and nothing in the logs said why.
 *
 * Reading the resolved list off a booted app is the only way to check it: the
 * order is decided by Nest's scanner, not by anything visible in one file.
 */
import { Test } from '@nestjs/testing';
import { AuthModule } from '@/auth/auth.module';

jest.mock('@/auth/instance/auth.instance', () => ({
  auth: { options: {}, api: {} },
  authPrismaClient: { $disconnect: jest.fn() },
  AUTH_BASE_PATH: '/api/auth',
}));
jest.mock('better-auth/node', () => ({
  toNodeHandler: () => () => undefined,
  fromNodeHeaders: jest.fn(),
}));

describe('global guard chain', () => {
  it('runs throttle, then session, then permissions', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const config = app as unknown as {
      applicationConfig?: { getGlobalGuards: () => object[] };
      config?: { getGlobalGuards: () => object[] };
    };
    const guards = (config.applicationConfig ??
      config.config)!.getGlobalGuards();

    expect(guards.map((guard) => guard.constructor.name)).toEqual([
      'TrustedOriginThrottlerGuard',
      'AuthGuard',
      'PermissionsGuard',
    ]);

    await app.close();
  });
});
