import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role } from '@prisma/client';
import { ANY_PERMISSIONS_KEY } from '@/auth/decorators/require-any-permission.decorator';
import { PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { PermissionsService } from '@/auth/permissions.service';

/**
 * Enforces @RequirePermissions() (AND) and @RequireAnyPermission() (OR).
 *
 * Registered as an APP_GUARD, running AFTER the session guard so
 * `request.user` is populated:
 *
 *   ThrottlerGuard -> AuthGuard -> RolesGuard -> PermissionsGuard
 *
 * A route that declares neither decorator passes through. That is deliberate:
 * the session guard already protects everything by default, and a route with no
 * permission declared is one any signed in user may reach.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const anyRequired = this.reflector.getAllAndOverride<Permission[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const hasAll = Array.isArray(required) && required.length > 0;
    const hasAny = Array.isArray(anyRequired) && anyRequired.length > 0;
    if (!hasAll && !hasAny) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id: string; role: Role } }>();

    // Guards against a route carrying both an anonymous opt out and a
    // permission requirement, which would otherwise read `undefined.role`.
    if (!request.user) {
      throw new ForbiddenException('Access denied');
    }

    if (hasAll) {
      const { granted, missing } = this.permissions.hasAll(
        request.user,
        required,
      );
      if (!granted) {
        throw new ForbiddenException(
          `Missing permissions: ${missing.join(', ')}`,
        );
      }
    }

    if (hasAny && !this.permissions.hasAny(request.user, anyRequired)) {
      throw new ForbiddenException(
        `Requires one of: ${anyRequired.join(', ')}`,
      );
    }

    return true;
  }
}
