import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
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
 *   ThrottlerGuard -> AuthGuard -> PermissionsGuard
 *
 * Cross module APP_GUARD ordering is not something this app can rely on (the
 * session guard is registered by an imported module), so this guard does not
 * assume `request.user` is populated. See the 401 branch below.
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

    // No session. 401, not 403: the caller has not identified themselves, so
    // this is not a question of what they are allowed to do.
    //
    // This deviates from the reference backend, which throws Forbidden here.
    // It can, because it registers every APP_GUARD in one module and so
    // guarantees its AuthGuard has already answered 401. Here the session guard
    // comes from @thallesp/nestjs-better-auth via an imported module, and
    // Nest's cross module APP_GUARD ordering put this guard first, turning
    // every unauthenticated request into a 403. Answering 401 is correct
    // whichever order they end up running in.
    if (!request.user) {
      throw new UnauthorizedException();
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
