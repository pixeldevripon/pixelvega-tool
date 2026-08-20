import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from '@/auth/auth.controller';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { PermissionsGuard } from '@/auth/permissions/permissions.guard';
import { PermissionsModule } from '@/auth/permissions/permissions.module';
import { authPrismaClient } from '@/auth/instance/auth.instance';
import {
  hasOwnThrottleOverride,
  isTrustedInternalOrigin,
} from '@/auth/throttle/internal-origin.util';
import { TrustedOriginThrottlerGuard } from '@/auth/throttle/trusted-origin-throttler.guard';

/**
 * The auth module owns the whole auth surface: the routes, the session guard,
 * the throttle, and better-auth's lifecycle.
 *
 * `AuthController` is a single catch-all that hands every `/api/auth/*` request
 * to better-auth. There is no hand written sign-in, forgot-password,
 * reset-password or change-password endpoint anywhere in this codebase, and
 * there must not be one: all four used to exist under `/auth-flows`, backed by
 * a bespoke `PasswordResetCode` table and a hand rolled JWT, which was a second
 * implementation of a security critical flow.
 *
 * ── All three guards are registered HERE, in this order ──
 *
 *   TrustedOriginThrottlerGuard -> AuthGuard -> PermissionsGuard
 *
 * which is the order directive D2 specifies, and each step depends on the one
 * before it: the throttle has to fire before the app spends a database round
 * trip resolving a session, and PermissionsGuard reads `request.user`, which
 * AuthGuard is what sets.
 *
 * They must stay in ONE module's providers array. Nest applies global enhancers
 * from the ROOT module before those from the modules it imports, so registering
 * PermissionsGuard in AppModule put it FIRST in the chain: it ran before
 * AuthGuard had resolved a session, found no `request.user`, and answered 401 to
 * every authenticated request. Verified by reading the resolved guard list off
 * a booted app; the spec below pins the order so it cannot drift back.
 *
 * `onModuleDestroy` disconnects the pre-DI Prisma client better-auth uses.
 * Before this, that pool was opened at module load and never closed, so a
 * graceful shutdown left connections behind.
 */
@Module({
  imports: [
    // Imported explicitly even though PermissionsModule is @Global: this module
    // registers PermissionsGuard, so it must be able to resolve
    // PermissionsService on its own rather than depending on the root module
    // having pulled the global in first.
    PermissionsModule,
    ThrottlerModule.forRoot({
      // A trusted first party origin bypasses the tiers, but ONLY on routes
      // that have not tightened their own limit. See internal-origin.util.ts:
      // a route with its own @Throttle() set it because the tiers were too
      // loose, so one leaked secret must not lift all of them at once.
      skipIf: (context) =>
        isTrustedInternalOrigin(context) && !hasOwnThrottleOverride(context),
      throttlers:
        // A single permissive tier under test, so an E2E suite firing hundreds
        // of requests in seconds does not spend its run getting 429s.
        process.env.NODE_ENV === 'test'
          ? [{ name: 'test', ttl: 60_000, limit: 10_000 }]
          : [
              // Sized for one authenticated dashboard page load, which
              // legitimately fans out many parallel requests on mount from a
              // single browser. The sustained and hourly caps still bound real
              // abuse, and better-auth's own per path limiter separately
              // handles password guessing.
              { name: 'short', ttl: 1_000, limit: 60 }, // burst: 60/s
              { name: 'medium', ttl: 60_000, limit: 300 }, // sustained: 300/min
              { name: 'long', ttl: 3_600_000, limit: 3_000 }, // hourly: 3000/hr
            ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Order matters and is the order they appear in. The throttle first, so an
    // abusive caller is turned away before the app spends a database round trip
    // resolving their session.
    { provide: APP_GUARD, useClass: TrustedOriginThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await authPrismaClient.$disconnect();
  }
}
