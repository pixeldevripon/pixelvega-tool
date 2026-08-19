import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { authPrismaClient } from '@/auth/instance/auth.instance';
import {
  hasOwnThrottleOverride,
  isTrustedInternalOrigin,
} from '@/auth/throttle/internal-origin.util';
import { TrustedOriginThrottlerGuard } from '@/auth/throttle/trusted-origin-throttler.guard';

/**
 * The auth module owns better-auth's lifecycle, the throttle, and the guard
 * order. It owns no routes.
 *
 * There is no controller here on purpose. Forgot-password, reset-password and
 * change-password used to be hand written endpoints under `/auth-flows`, backed
 * by a bespoke `PasswordResetCode` table and a hand rolled JWT. better-auth
 * serves all three itself now, which is one implementation of a security
 * critical flow instead of two.
 *
 * ── Why ThrottlerModule lives here and not in AppModule ──
 * APP_GUARD providers run in registration order, and the throttle has to fire
 * before anything touches the database for a session lookup. Registering the
 * module here puts its guard ahead of the auth guards, which is the order
 * directive D2 specifies:
 *
 *   TrustedOriginThrottlerGuard -> AuthGuard -> PermissionsGuard
 *
 * AuthGuard comes from `@thallesp/nestjs-better-auth`, registered by
 * `BetterAuthModule.forRoot()` in AppModule.
 *
 * `onModuleDestroy` disconnects the pre-DI Prisma client better-auth uses.
 * Before this, that pool was opened at module load and never closed, so a
 * graceful shutdown left connections behind.
 */
@Module({
  imports: [
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
  providers: [
    // ONLY the throttler here. PermissionsGuard is registered in AppModule's
    // own providers, which Nest processes AFTER every imported module, so the
    // final order comes out as:
    //
    //   TrustedOriginThrottlerGuard  (this module, imported first)
    //   AuthGuard                    (BetterAuthModule.forRoot, imported next)
    //   PermissionsGuard             (AppModule's own providers, last)
    //
    // Registering PermissionsGuard here too would put it ahead of AuthGuard,
    // and it reads request.user, which AuthGuard is what sets.
    { provide: APP_GUARD, useClass: TrustedOriginThrottlerGuard },
  ],
})
export class AuthModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await authPrismaClient.$disconnect();
  }
}
