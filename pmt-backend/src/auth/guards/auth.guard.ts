import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import { fromNodeHeaders } from 'better-auth/node';

import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { auth } from '@/auth/instance/auth.instance';
import type { AuthenticatedRequest, TypedAuthUser } from '@/auth/auth.types';

/**
 * Validates the better-auth session cookie on every request.
 *
 * Registered as an APP_GUARD in `AuthModule`, so it protects every route by
 * default. `@Public()` opts out. On success it attaches `request.user` and
 * `request.session`, which is what `@CurrentUser()` and `PermissionsGuard`
 * read.
 *
 * Two properties are worth stating because they are easy to lose. Both this
 * guard and the throttle are registered in `AuthModule`, in a known order, so
 * `PermissionsGuard` can rely on `request.user` being set by the time it runs.
 * And a suspended account is rejected on EVERY request, not only at sign-in.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      // Without this, better-auth may answer from the signed cookie snapshot,
      // which would keep a revoked session valid for the length of the cache:
      // a suspension, a password change, or a sign-out-everywhere would not
      // take effect until it expired. A guarded route has to ask the store.
      query: { disableCookieCache: true },
    });

    if (session) {
      const user = session.user as unknown as TypedAuthUser;

      // Suspending an account revokes its sessions, but a token minted in the
      // race window between the status write and the revoke would otherwise
      // keep working until it expired. The status is checked on every request,
      // not only at sign-in.
      //
      // Deletion is not checked here. It is a soft delete (`deletedAt`), which
      // is not on the session payload, and reading it would cost a database
      // round trip on every single request. `UsersService.remove` revokes the
      // account's sessions instead, which cuts it off at the same moment.
      if (user.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('Account is suspended');
      }

      request.user = user;
      request.session = session.session;
    }

    // A public route is allowed through either way. `request.user` is still
    // populated above when a session IS present, so a service level ownership
    // check sees the caller.
    if (isPublic) {
      return true;
    }

    if (!session) {
      throw new UnauthorizedException('No active session');
    }

    return true;
  }
}
