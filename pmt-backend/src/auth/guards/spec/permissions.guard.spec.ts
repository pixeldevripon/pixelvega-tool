/**
 * Unit tests for PermissionsGuard.
 *
 * This guard is the gate for every route in the app, so its default behaviour
 * matters as much as its rejections: a route with no permission declared must
 * pass through, and a route with one must never see an unauthenticated caller.
 */

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role } from '@prisma/client';
import { PermissionsService } from '@/auth/permissions.service';
import { ANY_PERMISSIONS_KEY } from '@/auth/decorators/require-any-permission.decorator';
import { PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../permissions.guard';

function contextFor(
  user: { id: string; role: Role } | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  /** Declare what the route asks for. */
  function route(opts: { all?: Permission[]; any?: Permission[] }) {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === PERMISSIONS_KEY
        ? opts.all
        : key === ANY_PERMISSIONS_KEY
          ? opts.any
          : undefined,
    );
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      new PermissionsService(),
    );
  });

  describe('a route that declares nothing', () => {
    it('passes through', () => {
      // The session guard already protects every route by default, so an
      // undeclared route is one any signed in user may reach.
      route({});
      expect(
        guard.canActivate(contextFor({ id: 'u1', role: Role.CLIENT })),
      ).toBe(true);
    });

    it('passes through even with an empty array declared', () => {
      route({ all: [], any: [] });
      expect(
        guard.canActivate(contextFor({ id: 'u1', role: Role.CLIENT })),
      ).toBe(true);
    });
  });

  describe('AND semantics', () => {
    it('allows a caller holding the permission', () => {
      route({ all: [Permission.CREATE_PROJECT] });
      expect(
        guard.canActivate(contextFor({ id: 'pm', role: Role.PROJECT_MANAGER })),
      ).toBe(true);
    });

    it('rejects a caller who does not hold it', () => {
      route({ all: [Permission.CREATE_PROJECT] });
      expect(() =>
        guard.canActivate(contextFor({ id: 'd', role: Role.DEVELOPER })),
      ).toThrow(ForbiddenException);
    });

    it('names the missing permission, so the failure is diagnosable', () => {
      route({ all: [Permission.ARCHIVE_PROJECT] });
      expect(() =>
        guard.canActivate(contextFor({ id: 'd', role: Role.DEVELOPER })),
      ).toThrow(/ARCHIVE_PROJECT/);
    });

    it('requires ALL of them, not just one', () => {
      route({ all: [Permission.CREATE_PROJECT, Permission.ARCHIVE_PROJECT] });
      // A PM holds CREATE_PROJECT but not ARCHIVE_PROJECT.
      expect(() =>
        guard.canActivate(contextFor({ id: 'pm', role: Role.PROJECT_MANAGER })),
      ).toThrow(ForbiddenException);
    });
  });

  describe('OR semantics', () => {
    it('allows a caller holding any one of them', () => {
      route({
        any: [Permission.VIEW_ALL_PROJECTS, Permission.VIEW_OWN_PROJECTS],
      });
      // A client holds only VIEW_OWN_PROJECTS, which is enough.
      expect(
        guard.canActivate(contextFor({ id: 'c', role: Role.CLIENT })),
      ).toBe(true);
    });

    it('rejects a caller holding none of them', () => {
      route({ any: [Permission.ARCHIVE_PROJECT, Permission.VIEW_AUDIT_LOG] });
      expect(() =>
        guard.canActivate(contextFor({ id: 'c', role: Role.CLIENT })),
      ).toThrow(/Requires one of/);
    });
  });

  describe('both declared on one route', () => {
    it('enforces both', () => {
      route({
        all: [Permission.CREATE_PROJECT],
        any: [Permission.ARCHIVE_PROJECT, Permission.VIEW_AUDIT_LOG],
      });
      // A PM satisfies the AND but not the OR.
      expect(() =>
        guard.canActivate(contextFor({ id: 'pm', role: Role.PROJECT_MANAGER })),
      ).toThrow(ForbiddenException);
      // An ADMIN satisfies both.
      expect(guard.canActivate(contextFor({ id: 'a', role: Role.ADMIN }))).toBe(
        true,
      );
    });
  });

  describe('an unauthenticated caller', () => {
    it('gets 401, not 403, and does not crash on a missing user', () => {
      // Not identified is a different answer from not allowed. This has to hold
      // regardless of whether the session guard ran first: cross module
      // APP_GUARD ordering is not something this app can rely on, because the
      // session guard is registered by an imported module.
      route({ all: [Permission.CREATE_PROJECT] });
      expect(() => guard.canActivate(contextFor(undefined))).toThrow(
        UnauthorizedException,
      );
    });

    it('gets 401 on an OR route too', () => {
      route({ any: [Permission.VIEW_OWN_PROJECTS] });
      expect(() => guard.canActivate(contextFor(undefined))).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('every role against a representative route', () => {
    it.each([
      [Role.SYSTEM_ADMIN, true],
      [Role.ADMIN, true],
      [Role.PROJECT_MANAGER, false],
      [Role.DEVELOPER, false],
      [Role.DESIGNER, false],
      [Role.CLIENT, false],
    ] as Array<[Role, boolean]>)(
      'ARCHIVE_PROJECT for %s is %s',
      (role, allowed) => {
        route({ all: [Permission.ARCHIVE_PROJECT] });
        if (allowed) {
          expect(guard.canActivate(contextFor({ id: 'u', role }))).toBe(true);
        } else {
          expect(() =>
            guard.canActivate(contextFor({ id: 'u', role })),
          ).toThrow(ForbiddenException);
        }
      },
    );
  });
});
