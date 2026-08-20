import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';

import { Public } from '@/auth/decorators/public.decorator';
import { auth } from '@/auth/instance/auth.instance';

/**
 * Mounts every better-auth route under `/api/auth/*`.
 *
 * One catch-all handler, because better-auth owns the whole auth surface: the
 * routes, their bodies, their errors, and their rate limits. There is no
 * hand written sign-in, password reset, or password change endpoint anywhere in
 * this codebase, and adding one would mean two implementations of a security
 * critical flow.
 *
 * ── Why a controller and not middleware ──
 * The routes used to be mounted as raw express middleware, by an adapter
 * package calling `httpAdapter.use()` in `onModuleInit()`. That put them ahead
 * of Nest's router, with two consequences: they were invisible to
 * `SwaggerModule`, and they never entered the guard pipeline, so a decorator
 * like `@SkipThrottle()` on them would have been decoration rather than
 * configuration. As a controller they are ordinary Nest routes, and the guards,
 * the filters and the throttle all see them.
 *
 * ── The path ──
 * `@Controller('auth')` plus the global `api` prefix resolves to `/api/auth`,
 * which is the literal `basePath` in the auth instance. Do not change one
 * without the other: better-auth strips its own base path off the incoming URL
 * before matching, so a mismatch turns every auth route into a 404.
 *
 * ── The decorators ──
 * `@Public()` is required. A caller cannot hold a session before signing in, so
 * `AuthGuard` would answer 401 to the very request that creates one.
 *
 * `@SkipThrottle()` keeps Nest's per-IP tiers off these routes. Auth is not
 * unprotected: better-auth runs its own per-path limiter (`rateLimit.customRules`
 * in the auth instance, 5/min on sign-in and each password flow), which is the
 * defense that matters for password guessing. Leaving the general tiers on as
 * well would let an unrelated burst lock a legitimate user out of sign-in, and
 * a dashboard page mounting several session consumers at once is exactly such a
 * burst.
 *
 * `@ApiExcludeController()` hides the catch-all from `/api/docs`. A single
 * `ALL /api/auth/*splat` entry documents nothing. The real auth documentation is
 * merged in from better-auth's own generated schema, one entry per actual route,
 * by `common/swagger/better-auth-schema.ts`.
 */
@Controller('auth')
@SkipThrottle()
@ApiExcludeController()
export class AuthController {
  /**
   * Built once, at construction. `toNodeHandler` closes over the auth instance
   * and holds no per-request state, so rebuilding it on every call would be
   * pure waste on the hottest route in the app (`get-session`).
   */
  private readonly handler = toNodeHandler(auth);

  @Public()
  @All('*splat')
  handleAuth(@Req() request: Request, @Res() response: Response) {
    return this.handler(request, response);
  }
}
