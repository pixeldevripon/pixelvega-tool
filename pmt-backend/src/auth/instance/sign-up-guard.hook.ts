import { Injectable, Logger } from '@nestjs/common';
import { BeforeHook, Hook } from '@thallesp/nestjs-better-auth';
import type { AuthHookContext } from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth';

/**
 * Closes `POST /api/auth/sign-up/email` to the outside world.
 *
 * ── Why not `emailAndPassword.disableSignUp` ──
 * better-auth enforces that flag inside its sign-up handler with no exemption
 * for server side `auth.api.signUpEmail()` calls, and both legitimate account
 * creation paths go through exactly that endpoint: `UsersService.invite()` and
 * `SystemAdminBootstrapService`. Setting the flag closed the public route AND
 * broke every invite, plus a fresh deployment's ability to create its first
 * admin at all.
 *
 * ── What this does instead ──
 * Refuses the request only when it arrived over HTTP. A direct
 * `auth.api.signUpEmail()` call carries no `request`, so the invite flow and
 * the bootstrap pass straight through while an anonymous caller is turned away.
 *
 * The role escalation this originally guarded is closed twice over regardless:
 * every `user.additionalFields` entry is `input: false`, so a request body
 * cannot set `role`, and a database hook refuses SYSTEM_ADMIN at the write.
 */
@Injectable()
@Hook()
export class SignUpGuardHook {
  private readonly logger = new Logger(SignUpGuardHook.name);

  /**
   * Password changes go through `PATCH /api/users/me/password`, not here.
   *
   * better-auth's own `/change-password` is mounted as middleware, so it never
   * reaches Nest's guard pipeline: it is NOT gated by
   * `@RequirePermissions(CHANGE_OWN_PASSWORD)` and it writes NO audit log
   * entry. `UsersService.changePassword` does both, and clears
   * `mustResetPassword`. Two doors to the same action with different security
   * properties is worse than one, so the weaker one is closed.
   *
   * Blocked for HTTP callers only, by the same test as sign-up, because
   * `UsersService.changePassword` reaches this endpoint through
   * `auth.api.changePassword()` and must keep working.
   */
  @BeforeHook('/change-password')
  blockDirectPasswordChange(ctx: AuthHookContext) {
    if (!(ctx as { request?: unknown }).request) {
      return;
    }
    throw new APIError('FORBIDDEN', {
      message:
        'Use PATCH /api/users/me/password to change your password. That route is permission gated and audited; this one is not.',
      code: 'USE_USERS_ME_PASSWORD',
    });
  }

  @BeforeHook('/sign-up/email')
  blockPublicSignUp(ctx: AuthHookContext) {
    // Present for an HTTP request, absent for a server side api call. That is
    // the whole distinction this hook rests on.
    const isHttpRequest = Boolean((ctx as { request?: unknown }).request);
    if (!isHttpRequest) {
      return;
    }

    this.logger.warn(
      'Refused an anonymous sign-up attempt. Accounts are created by invite only.',
    );
    throw new APIError('FORBIDDEN', {
      message:
        'Public sign-up is disabled. An administrator creates accounts by invitation.',
      code: 'SIGN_UP_DISABLED',
    });
  }
}
